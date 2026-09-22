<?php
/**
 * Moteur de commandes transactionnel (LOT 3) — portage 1:1 de db.createOrder (server/db.ts).
 *
 * Garanties (identiques a l'original Express) :
 * - Prix recalcules EXCLUSIVEMENT cote serveur : les options et supplements sont resous
 *   contre le catalogue officiel (jamais de prix client accepte).
 * - Stock verifie puis decremente DANS une transaction MySQL (START TRANSACTION / COMMIT /
 *   ROLLBACK) — une commande incomplete ne laisse AUCUNE trace.
 * - Numerotation sequentielle BEBBA-1101, BEBBA-1102, ... via compteur verrouille (FOR UPDATE).
 * - Idempotence : cle (header Idempotency-Key) + emetteur (client:ID ou guest:tel) + hash
 *   canonique SHA-256 du contenu — meme comportement que Firestore (200/201/403/422).
 * - Messages d'erreur 1:1 avec server.ts.
 *
 * Regle d'or : aucun acces a wp_users. Le client provient exclusivement de bebba_users
 * (via Bebba_HF_Auth) ou est un invite (guest).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Exception metier commande — code HTTP + message utilisateur + details optionnels.
 */
class Bebba_HF_Order_Exception extends Exception {

	public array $details = array();

	public function __construct( string $message, int $status = 400, array $details = array() ) {
		parent::__construct( $message, $status );
		$this->details = $details;
	}

	public function status(): int {
		return (int) $this->getCode();
	}
}

class Bebba_HF_Orders {

	const DELIVERY_FEE    = 2.5;
	const ORDER_SEQ_START = 1100; // 1re commande = BEBBA-1101 (identique a nextOrderSeq Express).

	private const RECEIVED_LABEL = 'Commande reçue & transmise à la cuisine';
	private const RECEIVED_NOTE  = 'Paiement à la livraison sélectionné';

	/* ================================================================
	 * CRÉATION TRANSACTIONNELLE
	 * ================================================================ */

	/**
	 * Création d'une commande. $payload : {client:{name,phone,deliveryAddress,notes}, items:[...]}.
	 * $ctx : {caller_id:string, idempotency_key:?string, client_id:?int}.
	 * Retour : array{order:array, isExisting:bool} ou WP_Error (data: status + details).
	 */
	public static function create( array $payload, array $ctx ) {
		global $wpdb;

		$client = isset( $payload['client'] ) && is_array( $payload['client'] ) ? $payload['client'] : array();
		$items  = isset( $payload['items'] ) && is_array( $payload['items'] ) ? $payload['items'] : array();

		if ( 0 === count( $items ) ) {
			return self::fail( 'Le panier est vide.', 400 );
		}

		$name  = substr( sanitize_text_field( (string) ( $client['name'] ?? '' ) ), 0, 128 );
		$phone = substr( sanitize_text_field( (string) ( $client['phone'] ?? '' ) ), 0, 32 );
		$addr  = substr( sanitize_text_field( (string) ( $client['deliveryAddress'] ?? '' ) ), 0, 512 );
		$notes = sanitize_text_field( (string) ( $client['notes'] ?? '' ) );
		if ( '' === $name || '' === $phone || '' === $addr ) {
			return self::fail( 'Veuillez renseigner le nom, téléphone et adresse de livraison.', 400 );
		}

		$caller_id    = (string) ( $ctx['caller_id'] ?? 'guest:unknown' );
		$idem_key_raw = trim( (string) ( $ctx['idempotency_key'] ?? '' ) );
		$idem_key     = '' !== $idem_key_raw ? substr( $idem_key_raw, 0, 128 ) : null;
		$client_id    = isset( $ctx['client_id'] ) && $ctx['client_id'] ? (int) $ctx['client_id'] : null;
		$request_hash = self::canonical_hash( $caller_id, $client, $items );

		$o      = Bebba_HF_DB::orders_table();
		$oi     = Bebba_HF_DB::order_items_table();
		$ois    = Bebba_HF_DB::order_item_supplements_table();
		$oip    = Bebba_HF_DB::order_item_prep_table();
		$osh    = Bebba_HF_DB::order_status_history_table();
		$ing    = Bebba_HF_DB::ingredients_table();
		$sm     = Bebba_HF_DB::stock_movements_table();
		$idem_t = Bebba_HF_DB::order_idempotency_table();

		Bebba_HF_DB::begin();
		try {

			/* 1. Idempotence — même sémantique que la transaction Firestore. */
			if ( null !== $idem_key ) {
				$idem = $wpdb->get_row(
					$wpdb->prepare( "SELECT * FROM {$idem_t} WHERE idempotency_key = %s", $idem_key ),
					ARRAY_A
				);
				if ( $idem ) {
					if ( $idem['caller_id'] !== $caller_id ) {
						throw new Bebba_HF_Order_Exception( 'Accès refusé : La clé d’idempotence appartient à un autre émetteur.', 403 );
					}
					if ( $idem['request_hash'] !== $request_hash ) {
						throw new Bebba_HF_Order_Exception( 'Conflit d’idempotence : La clé fournie est associée à un contenu de commande différent.', 422 );
					}
					if ( empty( $idem['order_id'] ) ) {
						throw new Bebba_HF_Order_Exception( 'Incohérence technique d’idempotence : enregistrement d’idempotence référençant une commande inexistante.', 500 );
					}
					$existing = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$o} WHERE id = %d", (int) $idem['order_id'] ), ARRAY_A );
					if ( ! $existing ) {
						throw new Bebba_HF_Order_Exception( sprintf( 'Incohérence technique d’idempotence : la commande #%d référencée est introuvable.', (int) $idem['order_id'] ), 500 );
					}
					Bebba_HF_DB::commit();
					return array( 'order' => self::format_order_row( $existing ), 'isExisting' => true );
				}
			}

			/* 2. Numéro séquentiel (compteur verrouillé dans la transaction). */
			$order_number = self::next_order_number();

			/* 3. TOUTES LES LECTURES AVANT TOUTE ÉCRITURE (comme Firestore). */
			$product_ids    = array();
			$needed_sup_ids = array();
			foreach ( $items as $raw ) {
				if ( ! is_array( $raw ) ) {
					continue;
				}
				$pid = trim( (string) ( $raw['productId'] ?? '' ) );
				if ( '' !== $pid ) {
					$product_ids[ $pid ] = true;
				}
				foreach ( ( is_array( $raw['supplements'] ?? null ) ? $raw['supplements'] : array() ) as $s ) {
					if ( ! is_array( $s ) ) {
						continue;
					}
					$sid = isset( $s['id'] ) ? trim( (string) $s['id'] ) : ( isset( $s['supplementId'] ) ? trim( (string) $s['supplementId'] ) : '' );
					if ( '' !== $sid ) {
						$needed_sup_ids[ $sid ] = true;
					}
				}
			}

			$products = array();
			foreach ( array_keys( $product_ids ) as $pid ) {
				$full = Bebba_HF_Catalog::get_product_full( $pid );
				if ( null === $full ) {
					throw new Bebba_HF_Order_Exception( sprintf( 'Produit #%s introuvable.', $pid ), 400 );
				}
				$products[ $pid ] = $full;
			}

			$sup_rows = self::load_supplement_rows( array_keys( $needed_sup_ids ) );

			$ing_biz = array( 'ing-quinoa' => 1, 'ing-patate-douce' => 1, 'ing-legumes' => 1, 'ing-riz' => 1 );
			foreach ( $products as $full ) {
				foreach ( ( $full['product']['baseIngredients'] ?? array() ) as $bi ) {
					$ing_biz[ (string) $bi['ingredientId'] ] = 1;
				}
			}
			foreach ( $sup_rows as $sr ) {
				$ing_biz[ self::biz( $sr['ingredient_legacy_id'], $sr['ingredient_id'] ) ] = 1;
			}
			$ing_rows = self::load_ingredient_rows( array_keys( $ing_biz ) );

			/* 4. CALCUL & VALIDATION MÉTIER (prix serveur uniquement). */
			$subtotal = 0.0;
			$computed = array();
			$required = array();

			foreach ( $items as $raw ) {
				if ( ! is_array( $raw ) ) {
					continue;
				}
				$pid = trim( (string) ( $raw['productId'] ?? '' ) );
				if ( ! isset( $products[ $pid ] ) ) {
					throw new Bebba_HF_Order_Exception( sprintf( 'Produit #%s introuvable.', $pid ), 400 );
				}
				$prod = $products[ $pid ]['product'];

				if ( ! $prod['active'] ) {
					throw new Bebba_HF_Order_Exception( sprintf( 'Le produit "%s" n’est plus actif au catalogue.', $prod['name'] ), 400 );
				}
				if ( ! $prod['available'] || ! $prod['isAvailable'] ) {
					throw new Bebba_HF_Order_Exception( sprintf( 'Le produit "%s" est actuellement indisponible.', $prod['name'] ), 400 );
				}

				$prep = self::prep_item( $prod, $raw, $sup_rows, $ing_rows );

				/* Portage Number.isInteger : 2 (int) et 2.0 (float entier) sont valides, 2.5 non. */
				$qty_raw = $raw['quantity'] ?? null;
				$qty     = ( is_int( $qty_raw ) || ( is_float( $qty_raw ) && floor( $qty_raw ) === $qty_raw ) )
					? (int) $qty_raw
					: null;
				if ( null === $qty || $qty < 1 || $qty > 100 ) {
					throw new Bebba_HF_Order_Exception(
						sprintf( 'La quantité pour le plat "%s" doit être un nombre entier compris entre 1 et 100 (reçu: %s).', $prod['name'], (string) $qty_raw ),
						400
					);
				}

				$item_total = self::round1( $prep['unit_price'] * $qty );
				$subtotal  += $item_total;

				$computed[] = array(
					'item_legacy' => 'item-' . self::rand_hex( 7 ),
					'row'         => $products[ $pid ]['row'],
					'product'     => $prod,
					'qty'         => $qty,
					'prep'        => $prep,
					'item_total'  => $item_total,
				);

				foreach ( $prep['total_ing'] as $ti ) {
					$need = self::round1( $ti['totalQuantity'] * $qty );
					if ( ! isset( $ing_rows[ $ti['ingredientId'] ] ) ) {
						throw new Bebba_HF_Order_Exception(
							sprintf( 'Ingrédient requis #%s (%s) introuvable dans le stock.', $ti['ingredientId'], $ti['ingredientName'] ),
							400
						);
					}
					$required[ $ti['ingredientId'] ] = isset( $required[ $ti['ingredientId'] ] )
						? self::round1( $required[ $ti['ingredientId'] ] + $need )
						: $need;
				}
			}

			/* 5. Vérification stricte du stock. */
			$missing = array();
			foreach ( $required as $biz => $need ) {
				$irow  = $ing_rows[ $biz ];
				$stock = self::round1( self::fl( $irow['stock_quantity'] ) ?? 0.0 );
				if ( $stock < $need ) {
					$missing[] = array(
						'ingredientId'   => $biz,
						'ingredientName' => (string) $irow['name'],
						'required'       => $need,
						'available'      => $stock,
						'missing'        => self::round1( $need - $stock ),
						'unit'           => (string) ( $irow['unit'] ?? 'g' ),
					);
				}
			}
			if ( ! empty( $missing ) ) {
				$parts = array();
				foreach ( $missing as $d ) {
					$parts[] = sprintf(
						'%s (requis : %s %s, disponible : %s %s, manquant : %s %s)',
						$d['ingredientName'], $d['required'], $d['unit'], $d['available'], $d['unit'], $d['missing'], $d['unit']
					);
				}
				throw new Bebba_HF_Order_Exception( 'Stock insuffisant : ' . implode( ', ', $parts ), 409, $missing );
			}

			/* 6. ÉCRITURES ATOMIQUES. */
			$now          = Bebba_HF_DB::now();
			$now_ms       = self::now_ms();
			$order_legacy = 'ord-' . (string) (int) round( microtime( true ) * 1000 );
			$token        = 'tk_' . self::rand_hex( 12 );
			$fee          = self::DELIVERY_FEE;
			$total        = self::round1( $subtotal + $fee );

			$ok = $wpdb->insert(
				$o,
				array(
					'legacy_id'         => $order_legacy,
					'order_number'      => $order_number,
					'tracking_token'    => $token,
					'placed_at'         => $now_ms,
					'customer_name'     => $name,
					'customer_phone'    => $phone,
					'delivery_address'  => $addr,
					'customer_notes'    => '' !== $notes ? $notes : null,
					'bebba_customer_id' => $client_id,
					'subtotal'          => self::round1( $subtotal ),
					'delivery_fee'      => $fee,
					'total_amount'      => $total,
					'status'            => 'received',
					'payment_status'    => 'to_collect',
					'payment_method'    => 'cash_on_delivery',
					'stock_consumed'    => 1,
					'idempotency_key'   => $idem_key,
				),
				array( '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%d', '%f', '%f', '%f', '%s', '%s', '%s', '%d', '%s' )
			);
			if ( false === $ok ) {
				throw new Bebba_HF_Order_Exception( 'Erreur interne lors de l’enregistrement de la commande.', 500 );
			}
			$order_id = (int) $wpdb->insert_id;

			foreach ( $computed as $c ) {
				$prod = $c['product'];
				$prep = $c['prep'];
				$qty  = $c['qty'];
				$row  = $c['row'];

				$ins_item = $wpdb->insert(
					$oi,
					array(
						'order_id'                    => $order_id,
						'legacy_id'                   => $c['item_legacy'],
						'product_id'                  => $row ? (int) $row['id'] : null,
						'product_legacy_id'           => (string) $prod['legacyId'],
						'product_name_snapshot'       => (string) $prod['name'],
						'unit_price'                  => $prep['unit_price'],
						'quantity'                    => $qty,
						'protein_option_label'        => $prep['protein']['label'] ?? null,
						'protein_option_extra_price'  => $prep['protein']['extraPrice'] ?? null,
						'protein_option_extra_grams'  => $prep['protein']['extraGrams'] ?? null,
						'veggies_option_label'        => $prep['veggies']['label'] ?? null,
						'veggies_option_extra_price'  => $prep['veggies']['extraPrice'] ?? null,
						'veggies_option_extra_grams'  => $prep['veggies']['extraGrams'] ?? null,
						'base_choice_label'           => $prep['base']['label'] ?? null,
						'base_choice_extra_price'     => $prep['base']['extraPrice'] ?? null,
						'options_raw_json'            => wp_json_encode(
							array(
								'proteinOption' => $prep['protein'],
								'veggiesOption' => $prep['veggies'],
								'baseChoice'    => $prep['base'],
							)
						),
						'special_instructions'        => $prep['special_instructions'],
						'item_total_price'            => $c['item_total'],
						'summary_lines_json'          => wp_json_encode( $prep['lines'] ),
					),
					array( '%d', '%s', '%d', '%s', '%s', '%f', '%d', '%s', '%f', '%f', '%s', '%f', '%f', '%s', '%f', '%s', '%s', '%f', '%s' )
				);
				if ( false === $ins_item ) {
					throw new Bebba_HF_Order_Exception( 'Erreur interne lors de l’enregistrement des lignes de commande.', 500 );
				}
				$item_id = (int) $wpdb->insert_id;

				foreach ( $prep['enriched'] as $es ) {
					$srow = $sup_rows[ $es['supplementId'] ] ?? null;
					$irow = $ing_rows[ $es['ingredientId'] ] ?? null;
					$wpdb->insert(
						$ois,
						array(
							'order_item_id'             => $item_id,
							'supplement_id'             => $srow ? (int) $srow['id'] : null,
							'supplement_legacy_id'      => (string) $es['supplementId'],
							'supplement_name_snapshot'  => (string) $es['name'],
							'price'                     => (float) $es['price'],
							'quantity'                  => (int) $es['quantity'],
							'ingredient_id'             => $irow ? (int) $irow['id'] : null,
							'ingredient_legacy_id'      => (string) $es['ingredientId'],
							'ingredient_name_snapshot'  => (string) $es['ingredientName'],
							'quantity_consumed'         => (float) $es['quantityConsumed'],
							'unit'                      => (string) $es['unit'],
						),
						array( '%d', '%d', '%s', '%s', '%f', '%d', '%d', '%s', '%s', '%f', '%s' )
					);
				}

				foreach ( $prep['total_ing'] as $ti ) {
					$irow = $ing_rows[ $ti['ingredientId'] ] ?? null;
					$wpdb->insert(
						$oip,
						array(
							'order_item_id'            => $item_id,
							'ingredient_id'            => $irow ? (int) $irow['id'] : null,
							'ingredient_legacy_id'     => (string) $ti['ingredientId'],
							'ingredient_name_snapshot' => (string) $ti['ingredientName'],
							'total_quantity'           => self::round1( $ti['totalQuantity'] * $qty ),
							'unit'                     => (string) $ti['unit'],
						),
						array( '%d', '%d', '%s', '%s', '%f', '%s' )
					);
				}
			}

			$wpdb->insert(
				$osh,
				array(
					'order_id'   => $order_id,
					'position'   => 1,
					'status'     => 'received',
					'label'      => self::RECEIVED_LABEL,
					'timestamp'  => $now_ms,
					'note'       => self::RECEIVED_NOTE,
					'updated_by' => 'Système Client',
				),
				array( '%d', '%d', '%s', '%s', '%s', '%s', '%s' )
			);

			foreach ( $required as $biz => $need ) {
				$irow      = $ing_rows[ $biz ];
				$new_stock = self::round1( ( self::fl( $irow['stock_quantity'] ) ?? 0.0 ) - $need );
				$wpdb->query(
					$wpdb->prepare( "UPDATE {$ing} SET stock_quantity = %s, updated_at = %s WHERE id = %d", number_format( $new_stock, 2, '.', '' ), $now, (int) $irow['id'] )
				);
				$wpdb->insert(
					$sm,
					array(
						'legacy_id'               => 'mov-' . (string) (int) round( microtime( true ) * 1000 ) . '-' . self::rand_hex( 4 ),
						'ingredient_id'           => (int) $irow['id'],
						'ingredient_legacy_id'    => (string) $irow['legacy_id'],
						'ingredient_name_snapshot' => (string) $irow['name'],
						'movement_type'           => 'order_consumption',
						'quantity'                => -1 * $need,
						'unit'                    => (string) ( $irow['unit'] ?? 'g' ),
						'order_id'                => $order_id,
						'order_legacy_id'         => $order_legacy,
						'order_number_snapshot'   => $order_number,
						'notes'                   => 'Consommation automatique commande #' . $order_number,
						'performed_by'            => 'Système BEBBA',
						'timestamp'               => $now,
					),
					array( '%s', '%d', '%s', '%s', '%s', '%f', '%s', '%d', '%s', '%s', '%s', '%s', '%s' )
				);
			}

			if ( null !== $idem_key ) {
				$ok_idem = $wpdb->insert(
					$idem_t,
					array(
						'idempotency_key'  => $idem_key,
						'caller_id'        => $caller_id,
						'request_hash'     => $request_hash,
						'order_id'         => $order_id,
						'order_legacy_id'  => $order_legacy,
					),
					array( '%s', '%s', '%s', '%d', '%s' )
				);
				if ( false === $ok_idem ) {
					/* Course concurrente : la clé vient d'être prise par une requête parallèle. */
					Bebba_HF_DB::rollback();
					$idem = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$idem_t} WHERE idempotency_key = %s", $idem_key ), ARRAY_A );
					if ( $idem && (int) $idem['order_id'] > 0 && $idem['caller_id'] === $caller_id && $idem['request_hash'] === $request_hash ) {
						$existing = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$o} WHERE id = %d", (int) $idem['order_id'] ), ARRAY_A );
						if ( $existing ) {
							return array( 'order' => self::format_order_row( $existing ), 'isExisting' => true );
						}
					}
					throw new Bebba_HF_Order_Exception( 'Incohérence technique d’idempotence : enregistrement d’idempotence référençant une commande inexistante.', 500 );
				}
			}

			Bebba_HF_DB::commit();

			$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$o} WHERE id = %d", $order_id ), ARRAY_A );
			return array( 'order' => $row ? self::format_order_row( $row ) : array(), 'isExisting' => false );

		} catch ( Bebba_HF_Order_Exception $e ) {
			Bebba_HF_DB::rollback();
			$data = array( 'status' => $e->status() );
			if ( ! empty( $e->details ) ) {
				$data['details'] = $e->details;
			}
			return new WP_Error( 'bebba_order_error', $e->getMessage(), $data );
		} catch ( Throwable $e ) {
			Bebba_HF_DB::rollback();
			return self::fail( 'Erreur interne.', 500 );
		}
	}

	/* ================================================================
	 * CONSULTATION (anti-IDOR)
	 * ================================================================ */

	/**
	 * Commande complète pour un utilisateur authentifié (règles IDOR d'origine :
	 * livreur -> uniquement ses commandes ; client -> uniquement les siennes).
	 */
	public static function get_for_user( string $biz_id, array $user ) {
		global $wpdb;
		$o = Bebba_HF_DB::orders_table();

		if ( ctype_digit( $biz_id ) ) {
			$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$o} WHERE legacy_id = %s OR id = %d", $biz_id, (int) $biz_id ), ARRAY_A );
		} else {
			$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$o} WHERE legacy_id = %s", $biz_id ), ARRAY_A );
		}
		if ( ! $row ) {
			return self::fail( 'Commande non trouvée.', 404 );
		}

		$role = (string) $user['role'];
		if ( 'driver' === $role ) {
			$my_driver = isset( $user['driverId'] ) ? (int) $user['driverId'] : 0;
			if ( ! $my_driver || (int) $row['driver_id'] !== $my_driver ) {
				return self::fail( 'Accès refusé : Cette commande ne vous est pas attribuée.', 403 );
			}
		} elseif ( 'client' === $role ) {
			$mine = ( (int) $row['bebba_customer_id'] === (int) $user['id'] )
				|| ( '' !== (string) ( $row['client_legacy_id'] ?? '' ) && (string) $row['client_legacy_id'] === (string) ( $user['legacy_id'] ?? '' ) );
			if ( ! $mine ) {
				return self::fail( 'Accès refusé : Vous ne pouvez pas accéder à cette commande.', 403 );
			}
		}

		return self::format_order_row( $row );
	}

	/** Historique d'un client (le plus récent d'abord). */
	public static function list_for_client( int $client_id ): array {
		global $wpdb;
		$o    = Bebba_HF_DB::orders_table();
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$o} WHERE bebba_customer_id = %d ORDER BY placed_at DESC, id DESC", $client_id ), ARRAY_A );
		$out  = array();
		foreach ( ( $rows ?: array() ) as $r ) {
			$out[] = self::format_order_row( $r );
		}
		return $out;
	}

	/* ================================================================
	 * FICHE DE PRÉPARATION (portage computePreparationSheet)
	 * ================================================================ */

	private static function prep_item( array $product, array $raw, array $sup_rows, array $ing_rows ): array {
		$name = (string) $product['name'];
		$custom = $product['customization'] ?? array();

		/* 1. Résolution stricte des options contre le catalogue officiel. */
		$protein = self::resolve_option( $raw['proteinOption'] ?? null, $custom['proteinOptions'] ?? array(), 'protéine', $name );
		$veggies = self::resolve_option( $raw['veggiesOption'] ?? null, $custom['veggiesOptions'] ?? array(), 'légumes', $name );
		$base    = self::resolve_base_option( $raw['baseChoice'] ?? null, $custom['baseChoices'] ?? array(), $name );

		/* 2. Carte des ingrédients (clé = ID métier, comme l'original). */
		$map = array();
		foreach ( ( $product['baseIngredients'] ?? array() ) as $bi ) {
			$b   = (string) $bi['ingredientId'];
			$row = $ing_rows[ $b ] ?? null;
			if ( $row && (int) $row['active'] === 0 ) {
				throw new Bebba_HF_Order_Exception(
					sprintf( 'Le produit "%s" ne peut pas être commandé car l’ingrédient de base "%s" est désactivé.', $name, (string) $row['name'] ),
					400
				);
			}
			$map[ $b ] = array(
				'name'     => (string) $bi['ingredientName'],
				'quantity' => (float) $bi['quantity'],
				'unit'     => (string) $bi['unit'],
			);
		}

		/* 3. Extra protéine / légumes (détection par motif d'identifiant, comme l'original). */
		if ( $protein && $protein['extraGrams'] > 0 ) {
			$hit = self::find_base( $product, array( 'poulet', 'boeuf', 'dinde', 'saumon', 'halloumi', 'ing-1', 'ing-2', 'ing-3' ) );
			if ( null !== $hit ) {
				$map[ $hit ]['quantity'] += $protein['extraGrams'];
			}
		}
		if ( $veggies && $veggies['extraGrams'] > 0 ) {
			$hit = self::find_base( $product, array( 'legumes', 'ing-4', 'ing-5' ) );
			if ( null !== $hit ) {
				$map[ $hit ]['quantity'] += $veggies['extraGrams'];
			}
		}

		/* 4. Substitution de base (Quinoa / Patates douces / 100% Légumes). */
		if ( $base && false !== stripos( $base['label'], 'Quinoa' ) ) {
			$rice = self::find_base_exact( $product, array( 'ing-riz', 'ing-6' ) );
			if ( null !== $rice && isset( $map[ $rice ] ) ) {
				$q = $map[ $rice ]['quantity'];
				unset( $map[ $rice ] );
				$map['ing-quinoa'] = array( 'name' => 'Quinoa royal aux graines', 'quantity' => $q, 'unit' => 'g' );
			}
		} elseif ( $base && false !== stripos( $base['label'], 'Patates douces' ) ) {
			$rice = self::find_base_exact( $product, array( 'ing-riz', 'ing-6' ) );
			if ( null !== $rice && isset( $map[ $rice ] ) ) {
				$q = $map[ $rice ]['quantity'];
				unset( $map[ $rice ] );
				$map['ing-patate-douce'] = array( 'name' => 'Patates douces rôties au romarin', 'quantity' => $q, 'unit' => 'g' );
			}
		} elseif ( $base && false !== stripos( $base['label'], '100% Légumes' ) ) {
			$rice = self::find_base_exact( $product, array( 'ing-riz', 'ing-6', 'ing-patate-douce' ) );
			if ( null !== $rice && isset( $map[ $rice ] ) ) {
				$q = $map[ $rice ]['quantity'];
				unset( $map[ $rice ] );
				$leg = isset( $map['ing-legumes'] ) ? 'ing-legumes' : ( isset( $map['ing-5'] ) ? 'ing-5' : null );
				if ( null !== $leg ) {
					$map[ $leg ]['quantity'] += $q;
				}
			}
		}

		/* 5. Suppléments (enrichis + consommation d'ingrédients). */
		$enriched   = array();
		$sup_price  = 0.0;
		foreach ( self::merge_supplements( $raw['supplements'] ?? array() ) as $sid => $q ) {
			$row = $sup_rows[ $sid ] ?? null;
			if ( ! $row || $q <= 0 ) {
				continue; // Supplément inconnu : ignoré silencieusement (1:1 avec l'original).
			}
			if ( (int) $row['active'] !== 1 ) {
				throw new Bebba_HF_Order_Exception( sprintf( 'Le supplément "%s" n’est plus actif au catalogue.', (string) $row['name'] ), 400 );
			}
			if ( (int) $row['available'] === 0 || ( null !== $row['is_available'] && (int) $row['is_available'] === 0 ) ) {
				throw new Bebba_HF_Order_Exception( sprintf( 'Le supplément "%s" est actuellement indisponible.', (string) $row['name'] ), 400 );
			}
			if ( null !== $row['ingredient_active'] && (int) $row['ingredient_active'] === 0 ) {
				throw new Bebba_HF_Order_Exception(
					sprintf( 'Le supplément "%s" n’est plus disponible car son ingrédient "%s" est désactivé.', (string) $row['name'], (string) $row['ingredient_name_snapshot'] ),
					400
				);
			}

			$qc = self::fl( $row['quantity_consumed'] );
			if ( ! $qc ) {
				$qc = self::fl( $row['legacy_quantity'] );
			}
			if ( ! $qc ) {
				$qc = 100.0;
			}
			$total_sup_qty = $qc * $q;
			$sup_price    += ( (float) $row['price'] ) * $q;

			$ing_biz = self::biz( $row['ingredient_legacy_id'], $row['ingredient_id'] );
			$ing_nm  = (string) ( $row['ingredient_name_snapshot'] ?: $row['name'] );
			if ( isset( $map[ $ing_biz ] ) ) {
				$map[ $ing_biz ]['quantity'] += $total_sup_qty;
			} else {
				$map[ $ing_biz ] = array(
					'name'     => $ing_nm,
					'quantity' => $total_sup_qty,
					'unit'     => (string) ( $row['unit'] ?: 'g' ),
				);
			}

			$enriched[] = array(
				'supplementId'     => self::biz( $row['legacy_id'], $row['id'] ),
				'name'             => (string) $row['name'],
				'price'            => (float) $row['price'],
				'quantity'         => $q,
				'ingredientId'     => $ing_biz,
				'ingredientName'   => $ing_nm,
				'quantityConsumed' => $total_sup_qty,
				'unit'             => (string) ( $row['unit'] ?: 'g' ),
			);
		}

		/* 6. Prix unitaire — AUTORITÉ SERVEUR. */
		$unit_price = self::round1(
			(float) $product['basePrice']
			+ ( $protein ? (float) $protein['extraPrice'] : 0 )
			+ ( $veggies ? (float) $veggies['extraPrice'] : 0 )
			+ ( $base ? (float) $base['extraPrice'] : 0 )
			+ $sup_price
		);

		/* 7. Fiche de préparation (par unité, comme l'original quantityMultiplier = 1). */
		$total_ing = array();
		$lines     = array();
		foreach ( $map as $biz => $m ) {
			$total_ing[] = array(
				'ingredientId'   => $biz,
				'ingredientName' => $m['name'],
				'totalQuantity'  => self::round1( $m['quantity'] ),
				'unit'           => $m['unit'],
			);
			$lines[] = self::summary_icon( $m['name'] ) . ' ' . $m['name'] . ': ' . (string) (int) round( $m['quantity'] ) . ' ' . $m['unit'];
		}
		$instr = trim( (string) ( $raw['specialInstructions'] ?? '' ) );
		if ( '' !== $instr ) {
			$lines[] = '⚠️ NOTE CLIENT: « ' . $instr . ' »';
		}

		return array(
			'unit_price'          => $unit_price,
			'protein'             => $protein,
			'veggies'             => $veggies,
			'base'                => $base,
			'enriched'            => $enriched,
			'total_ing'           => $total_ing,
			'lines'               => $lines,
			'special_instructions' => '' !== $instr ? $instr : null,
		);
	}

	/** Résolution stricte d'une option protéine/légumes — valeurs OFFICIELLES uniquement. */
	private static function resolve_option( $opt, array $official_list, string $kind, string $product_name ): ?array {
		$label = is_array( $opt ) ? trim( (string) ( $opt['label'] ?? '' ) ) : trim( (string) $opt );
		if ( '' === $label ) {
			return null;
		}
		foreach ( $official_list as $official ) {
			if ( mb_strtolower( trim( (string) $official['label'] ) ) === mb_strtolower( $label ) ) {
				return array(
					'label'      => (string) $official['label'],
					'extraPrice' => self::round1( max( 0, (float) ( $official['extraPrice'] ?? 0 ) ) ),
					'extraGrams' => self::round1( max( 0, (float) ( $official['extraGrams'] ?? 0 ) ) ),
				);
			}
		}
		throw new Bebba_HF_Order_Exception(
			sprintf( 'L’option de portion de %1$s "%2$s" n’est pas autorisée pour le plat "%3$s".', $kind, $label, $product_name ),
			400
		);
	}

	private static function resolve_base_option( $opt, array $official_list, string $product_name ): ?array {
		$label = is_array( $opt ) ? trim( (string) ( $opt['label'] ?? '' ) ) : trim( (string) $opt );
		if ( '' === $label ) {
			return null;
		}
		foreach ( $official_list as $official ) {
			if ( mb_strtolower( trim( (string) $official['label'] ) ) === mb_strtolower( $label ) ) {
				return array(
					'label'      => (string) $official['label'],
					'extraPrice' => self::round1( max( 0, (float) ( $official['extraPrice'] ?? 0 ) ) ),
				);
			}
		}
		throw new Bebba_HF_Order_Exception(
			sprintf( 'Le choix d’accompagnement/base "%s" n’est pas autorisé pour le plat "%s".', $label, $product_name ),
			400
		);
	}

	private static function merge_supplements( $supplements ): array {
		$merged = array();
		if ( ! is_array( $supplements ) ) {
			return $merged;
		}
		foreach ( $supplements as $s ) {
			if ( ! is_array( $s ) ) {
				continue;
			}
			$sid = isset( $s['id'] ) ? trim( (string) $s['id'] ) : ( isset( $s['supplementId'] ) ? trim( (string) $s['supplementId'] ) : '' );
			$q   = (int) ( $s['quantity'] ?? 1 );
			if ( '' === $sid || $q <= 0 ) {
				continue;
			}
			$merged[ $sid ] = ( $merged[ $sid ] ?? 0 ) + $q;
		}
		return $merged;
	}

	private static function find_base( array $product, array $needles ): ?string {
		foreach ( ( $product['baseIngredients'] ?? array() ) as $bi ) {
			$b = (string) $bi['ingredientId'];
			foreach ( $needles as $n ) {
				if ( false !== strpos( $b, $n ) ) {
					return $b;
				}
			}
		}
		return null;
	}

	private static function find_base_exact( array $product, array $ids ): ?string {
		foreach ( ( $product['baseIngredients'] ?? array() ) as $bi ) {
			if ( in_array( (string) $bi['ingredientId'], $ids, true ) ) {
				return (string) $bi['ingredientId'];
			}
		}
		return null;
	}

	private static function summary_icon( string $name ): string {
		if ( false !== mb_strpos( $name, 'Poulet' ) ) { return '🍗'; }
		if ( false !== mb_strpos( $name, 'Bœuf' ) ) { return '🥩'; }
		if ( false !== mb_strpos( $name, 'Dinde' ) ) { return '🍗'; }
		if ( false !== mb_strpos( $name, 'Saumon' ) ) { return '🐟'; }
		if ( false !== mb_strpos( $name, 'Riz' ) || false !== mb_strpos( $name, 'Quinoa' ) ) { return '🍚'; }
		if ( false !== mb_strpos( $name, 'Légumes' ) ) { return '🥦'; }
		if ( false !== mb_strpos( $name, 'Avocat' ) ) { return '🥑'; }
		if ( false !== mb_strpos( $name, 'Œuf' ) ) { return '🥚'; }
		if ( false !== mb_strpos( $name, 'Halloumi' ) ) { return '🧀'; }
		if ( false !== mb_strpos( $name, 'Sauce' ) ) { return '🥣'; }
		return '🌿';
	}

	/* ================================================================
	 * FORMATAGE (contrat Order de src/types.ts)
	 * ================================================================ */

	private static function format_order_row( array $row ): array {
		return array(
			'id'                 => (string) $row['legacy_id'],
			'orderNumber'        => (string) $row['order_number'],
			'trackingToken'      => (string) $row['tracking_token'],
			'createdAt'          => self::iso_ms( $row['placed_at'] ),
			'clientId'           => ( '' !== (string) ( $row['client_legacy_id'] ?? '' ) )
				? (string) $row['client_legacy_id']
				: ( null !== $row['bebba_customer_id'] ? (string) $row['bebba_customer_id'] : null ),
			'client'             => array(
				'name'            => (string) $row['customer_name'],
				'phone'           => (string) $row['customer_phone'],
				'deliveryAddress' => (string) $row['delivery_address'],
				'notes'           => (string) ( $row['customer_notes'] ?? '' ),
			),
			'items'              => self::format_items( (int) $row['id'] ),
			'subtotal'           => self::fl( $row['subtotal'] ),
			'deliveryFee'        => self::fl( $row['delivery_fee'] ),
			'totalAmount'        => self::fl( $row['total_amount'] ),
			'status'             => (string) $row['status'],
			'paymentMethod'      => (string) $row['payment_method'],
			'paymentStatus'      => (string) $row['payment_status'],
			'assignedDriverId'   => ( '' !== (string) ( $row['driver_legacy_id'] ?? '' ) )
				? (string) $row['driver_legacy_id']
				: ( null !== $row['driver_id'] ? (string) $row['driver_id'] : null ),
			'assignedDriverName' => '' !== (string) ( $row['driver_name_snapshot'] ?? '' ) ? (string) $row['driver_name_snapshot'] : null,
			'stockConsumed'      => null === $row['stock_consumed'] ? null : ( (int) $row['stock_consumed'] === 1 ),
			'statusHistory'      => self::format_history( (int) $row['id'] ),
		);
	}

	private static function format_items( int $order_id ): array {
		global $wpdb;
		$oi  = Bebba_HF_DB::order_items_table();
		$ois = Bebba_HF_DB::order_item_supplements_table();
		$oip = Bebba_HF_DB::order_item_prep_table();

		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$oi} WHERE order_id = %d ORDER BY id ASC", $order_id ), ARRAY_A );
		$out  = array();
		foreach ( ( $rows ?: array() ) as $r ) {
			$opts  = json_decode( (string) ( $r['options_raw_json'] ?? 'null' ), true );
			$lines = json_decode( (string) ( $r['summary_lines_json'] ?? '[]' ), true );
			if ( ! is_array( $lines ) ) {
				$lines = array();
			}
			$qty      = (int) $r['quantity'];
			$sup_rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$ois} WHERE order_item_id = %d ORDER BY id ASC", (int) $r['id'] ), ARRAY_A );
			$supps    = array();
			foreach ( ( $sup_rows ?: array() ) as $s ) {
				$supps[] = array(
					'supplementId'     => self::biz( $s['supplement_legacy_id'], $s['supplement_id'] ),
					'name'             => (string) $s['supplement_name_snapshot'],
					'price'            => self::fl( $s['price'] ),
					'quantity'         => (int) $s['quantity'],
					'ingredientId'     => self::biz( $s['ingredient_legacy_id'], $s['ingredient_id'] ),
					'ingredientName'   => (string) ( $s['ingredient_name_snapshot'] ?? '' ),
					'quantityConsumed' => self::fl( $s['quantity_consumed'] ),
					'unit'             => (string) $s['unit'],
				);
			}
			$prep_rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$oip} WHERE order_item_id = %d ORDER BY id ASC", (int) $r['id'] ), ARRAY_A );
			$total_ing = array();
			foreach ( ( $prep_rows ?: array() ) as $p ) {
				$tot = self::fl( $p['total_quantity'] ) ?? 0.0;
				$total_ing[] = array(
					'ingredientId'   => (string) $p['ingredient_legacy_id'],
					'ingredientName' => (string) $p['ingredient_name_snapshot'],
					'totalQuantity'  => $qty > 0 ? self::round1( $tot / $qty ) : $tot,
					'unit'           => (string) $p['unit'],
				);
			}
			$out[] = array(
				'id'                  => (string) $r['legacy_id'],
				'productId'           => ( '' !== (string) $r['product_legacy_id'] ) ? (string) $r['product_legacy_id'] : (string) $r['product_id'],
				'productName'         => (string) $r['product_name_snapshot'],
				'unitPrice'           => self::fl( $r['unit_price'] ),
				'quantity'            => $qty,
				'proteinOption'       => is_array( $opts ) ? ( $opts['proteinOption'] ?? null ) : null,
				'veggiesOption'       => is_array( $opts ) ? ( $opts['veggiesOption'] ?? null ) : null,
				'baseChoice'          => is_array( $opts ) ? ( $opts['baseChoice'] ?? null ) : null,
				'supplements'         => $supps,
				'specialInstructions' => '' !== (string) ( $r['special_instructions'] ?? '' ) ? (string) $r['special_instructions'] : null,
				'itemTotalPrice'      => self::fl( $r['item_total_price'] ),
				'preparationSheet'    => array(
					'totalIngredients' => $total_ing,
					'summaryLines'     => $lines,
				),
			);
		}
		return $out;
	}

	private static function format_history( int $order_id ): array {
		global $wpdb;
		$osh  = Bebba_HF_DB::order_status_history_table();
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$osh} WHERE order_id = %d ORDER BY position ASC", $order_id ), ARRAY_A );
		$out  = array();
		foreach ( ( $rows ?: array() ) as $r ) {
			$out[] = array(
				'status'    => (string) $r['status'],
				'label'     => (string) $r['label'],
				'timestamp' => self::iso_ms( $r['timestamp'] ),
				'note'      => '' !== (string) ( $r['note'] ?? '' ) ? (string) $r['note'] : null,
				'updatedBy' => '' !== (string) ( $r['updated_by'] ?? '' ) ? (string) $r['updated_by'] : null,
			);
		}
		return $out;
	}

	/* ================================================================
	 * OUTILS
	 * ================================================================ */

	private static function next_order_number(): string {
		global $wpdb;
		$t = Bebba_HF_DB::counters_table();
		$cur = $wpdb->get_var( $wpdb->prepare( "SELECT current_value FROM {$t} WHERE counter_name = %s FOR UPDATE", 'orders' ) );
		if ( null === $cur ) {
			$wpdb->query( $wpdb->prepare( "INSERT INTO {$t} (counter_name, current_value) VALUES (%s, %d)", 'orders', self::ORDER_SEQ_START ) );
		}
		$wpdb->query( $wpdb->prepare( "UPDATE {$t} SET current_value = current_value + 1 WHERE counter_name = %s", 'orders' ) );
		return 'BEBBA-' . $wpdb->get_var( $wpdb->prepare( "SELECT current_value FROM {$t} WHERE counter_name = %s", 'orders' ) );
	}

	private static function load_supplement_rows( array $biz_ids ): array {
		global $wpdb;
		if ( empty( $biz_ids ) ) {
			return array();
		}
		$legacy = array();
		$nums   = array();
		foreach ( $biz_ids as $b ) {
			if ( ctype_digit( $b ) ) {
				$nums[] = (int) $b;
			} else {
				$legacy[] = $b;
			}
		}
		$s      = Bebba_HF_DB::supplements_table();
		$i      = Bebba_HF_DB::ingredients_table();
		$where  = array();
		$params = array();
		if ( ! empty( $legacy ) ) {
			$where[]  = 's.legacy_id IN (' . implode( ',', array_fill( 0, count( $legacy ), '%s' ) ) . ')';
			array_push( $params, ...$legacy );
		}
		if ( ! empty( $nums ) ) {
			$where[]  = 's.id IN (' . implode( ',', array_fill( 0, count( $nums ), '%d' ) ) . ')';
			array_push( $params, ...$nums );
		}
		$rows = $wpdb->get_results(
			$wpdb->prepare( "SELECT s.*, i.active AS ingredient_active FROM {$s} s LEFT JOIN {$i} i ON i.id = s.ingredient_id WHERE " . implode( ' OR ', $where ), ...$params ),
			ARRAY_A
		);
		$out = array();
		foreach ( ( $rows ?: array() ) as $r ) {
			$out[ self::biz( $r['legacy_id'], $r['id'] ) ] = $r;
		}
		return $out;
	}

	private static function load_ingredient_rows( array $biz_ids ): array {
		global $wpdb;
		if ( empty( $biz_ids ) ) {
			return array();
		}
		$legacy = array();
		$nums   = array();
		foreach ( $biz_ids as $b ) {
			if ( ctype_digit( $b ) ) {
				$nums[] = (int) $b;
			} else {
				$legacy[] = $b;
			}
		}
		$i      = Bebba_HF_DB::ingredients_table();
		$where  = array();
		$params = array();
		if ( ! empty( $legacy ) ) {
			$where[]  = 'legacy_id IN (' . implode( ',', array_fill( 0, count( $legacy ), '%s' ) ) . ')';
			array_push( $params, ...$legacy );
		}
		if ( ! empty( $nums ) ) {
			$where[]  = 'id IN (' . implode( ',', array_fill( 0, count( $nums ), '%d' ) ) . ')';
			array_push( $params, ...$nums );
		}
		$rows = $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$i} WHERE " . implode( ' OR ', $where ), ...$params ),
			ARRAY_A
		);
		$out = array();
		foreach ( ( $rows ?: array() ) as $r ) {
			$out[ self::biz( $r['legacy_id'], $r['id'] ) ] = $r;
		}
		return $out;
	}

	/** Hash canonique déterministe du contenu (portage buildDeterministicOrderHash). */
	private static function canonical_hash( string $caller_id, array $client, array $items ): string {
		$phone8   = self::phone8( (string) ( $client['phone'] ?? '' ) ) ?? '';
		$addr     = self::normalize_address( (string) ( $client['deliveryAddress'] ?? '' ) );
		$cname    = trim( (string) ( $client['name'] ?? '' ) );
		$cnotes   = trim( (string) ( $client['notes'] ?? '' ) );

		$canonical_items = array();
		foreach ( $items as $it ) {
			if ( ! is_array( $it ) ) {
				continue;
			}
			$sups = array();
			foreach ( ( is_array( $it['supplements'] ?? null ) ? $it['supplements'] : array() ) as $s ) {
				if ( ! is_array( $s ) ) {
					continue;
				}
				$sid = isset( $s['id'] ) ? trim( (string) $s['id'] ) : ( isset( $s['supplementId'] ) ? trim( (string) $s['supplementId'] ) : '' );
				$sq  = (int) ( $s['quantity'] ?? 1 );
				if ( '' === $sid || $sq <= 0 ) {
					continue;
				}
				$sups[] = array( 'id' => $sid, 'quantity' => $sq );
			}
			usort( $sups, function ( $a, $b ) {
				return strcmp( $a['id'], $b['id'] );
			} );
			$p   = is_array( $it['proteinOption'] ?? null ) ? $it['proteinOption'] : array();
			$v   = is_array( $it['veggiesOption'] ?? null ) ? $it['veggiesOption'] : array();
			$bc  = is_array( $it['baseChoice'] ?? null ) ? $it['baseChoice'] : array();
			$canonical_items[] = array(
				'productId'           => trim( (string) ( $it['productId'] ?? '' ) ),
				'quantity'            => (int) ( $it['quantity'] ?? 1 ),
				'protein'             => array(
					'label' => trim( (string) ( $p['label'] ?? '' ) ),
					'grams' => (int) ( $p['extraGrams'] ?? 0 ),
					'price' => (float) ( $p['extraPrice'] ?? 0 ),
				),
				'veggies'             => array(
					'label' => trim( (string) ( $v['label'] ?? '' ) ),
					'grams' => (int) ( $v['extraGrams'] ?? 0 ),
					'price' => (float) ( $v['extraPrice'] ?? 0 ),
				),
				'base'                => array(
					'label' => trim( (string) ( $bc['label'] ?? '' ) ),
					'price' => (float) ( $bc['extraPrice'] ?? 0 ),
				),
				'supplements'         => $sups,
				'specialInstructions' => trim( (string) ( $it['specialInstructions'] ?? '' ) ),
			);
		}
		usort( $canonical_items, function ( $a, $b ) {
			return strcmp( wp_json_encode( $a ), wp_json_encode( $b ) );
		} );

		$payload = array(
			'callerId'          => $caller_id,
			'phoneNormalized'   => $phone8,
			'addressNormalized' => $addr,
			'clientName'        => $cname,
			'clientNotes'       => $cnotes,
			'items'             => $canonical_items,
		);
		return hash( 'sha256', wp_json_encode( $payload ) );
	}

	/** normalizePhoneNumber d'origine : chiffres seuls, 8 minimum, 8 derniers conservés. */
	public static function phone8( string $raw ): ?string {
		$digits = preg_replace( '/[^0-9]/', '', $raw );
		if ( null === $digits || strlen( $digits ) < 8 ) {
			return null;
		}
		return substr( $digits, -8 );
	}

	private static function normalize_address( string $addr ): string {
		$addr = trim( mb_strtolower( $addr ) );
		return (string) preg_replace( '/\s+/u', ' ', $addr );
	}

	private static function round1( $v ): float {
		return round( (float) $v * 10 ) / 10;
	}

	private static function fl( $val ): ?float {
		return null === $val ? null : (float) $val;
	}

	private static function biz( $legacy, $numeric ): string {
		return ( null !== $legacy && '' !== (string) $legacy ) ? (string) $legacy : (string) $numeric;
	}

	private static function rand_hex( int $len ): string {
		return substr( bin2hex( random_bytes( (int) ceil( $len / 2 ) ) ), 0, $len );
	}

	/** Horodatage UTC avec millisecondes (colonnes DATETIME(3)). */
	private static function now_ms(): string {
		$t  = microtime( true );
		$ms = (int) round( ( $t - floor( $t ) ) * 1000 );
		if ( $ms > 999 ) {
			$ms = 999;
		}
		return gmdate( 'Y-m-d H:i:s', (int) floor( $t ) ) . '.' . sprintf( '%03d', $ms );
	}

	private static function iso_ms( ?string $dt ): ?string {
		if ( ! $dt ) {
			return null;
		}
		$dt = str_replace( ' ', 'T', (string) $dt );
		if ( false === strpos( $dt, '.' ) ) {
			$dt .= '.000';
		}
		return $dt . 'Z';
	}

	private static function fail( string $message, int $status, array $details = array() ) {
		$data = array( 'status' => $status );
		if ( ! empty( $details ) ) {
			$data['details'] = $details;
		}
		return new WP_Error( 'bebba_order_error', $message, $data );
	}

	/* ================================================================
	 * FLUX CUISINE & LIVREUR (LOT 5 — portage server.ts l.674/1089/1174/1191
	 * + db.updateOrderStatus l.1491 / assignDriver l.1646 / updatePaymentStatus l.1679,
	 * + restauration de stock à l'annulation exigée par la spec §6.3 — constat C2).
	 * ================================================================ */

	const STATUS_LABELS = array(
		'received'           => 'Commande reçue',
		'preparing'          => 'En préparation en cuisine',
		'ready'              => 'Commande prête & emballée',
		'waiting_for_driver' => 'En attente de livreur',
		'delivering'         => 'En cours de livraison',
		'delivered'          => 'Commande livrée au client',
		'cancelled'          => 'Commande annulée',
	);

	/**
	 * Matrice stricte des transitions (portage de isValidStatusTransition,
	 * server/auth.ts l.147-190) : aucun saut d'étape, aucun retour arrière,
	 * client et admin_readonly ne peuvent jamais changer un statut.
	 */
	public static function is_valid_status_transition( string $current, string $target, string $role ): bool {
		if ( 'client' === $role || 'admin_readonly' === $role ) {
			return false;
		}
		if ( $current === $target ) {
			return true; // no-op idempotent (géré avant l'appel, comme Express).
		}
		if ( 'admin' === $role ) {
			$lifecycle = array(
				'received'           => array( 'preparing', 'cancelled' ),
				'preparing'          => array( 'ready', 'cancelled' ),
				'ready'              => array( 'waiting_for_driver', 'cancelled' ),
				'waiting_for_driver' => array( 'delivering', 'cancelled' ),
				'delivering'         => array( 'delivered', 'cancelled' ),
				'delivered'          => array(),
				'cancelled'          => array(),
			);
			return in_array( $target, $lifecycle[ $current ] ?? array(), true );
		}
		if ( 'kitchen' === $role ) {
			// La cuisine s'arrête strictement à 'ready' (le système pose ensuite
			// automatiquement 'waiting_for_driver').
			return ( 'received' === $current && 'preparing' === $target )
				|| ( 'preparing' === $current && 'ready' === $target );
		}
		if ( 'driver' === $role ) {
			// Le livreur confirme uniquement la livraison physique (Rule 5) ;
			// seul l'Admin assigne les courses (Rule 4).
			return 'delivering' === $current && 'delivered' === $target;
		}
		return false;
	}

	/** Ligne brute d'une commande depuis un id business (legacy_id ou id numérique). */
	private static function find_order_row( string $biz_id ): ?array {
		global $wpdb;
		$o = Bebba_HF_DB::orders_table();
		if ( ctype_digit( $biz_id ) ) {
			$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$o} WHERE legacy_id = %s OR id = %d", $biz_id, (int) $biz_id ), ARRAY_A );
		} else {
			$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$o} WHERE legacy_id = %s", $biz_id ), ARRAY_A );
		}
		return $row ? $row : null;
	}

	/** Ligne brute d'un livreur depuis un id business (legacy_id ou id numérique). */
	private static function find_driver_row( string $biz ): ?array {
		global $wpdb;
		$d = Bebba_HF_DB::drivers_table();
		if ( '' === $biz ) {
			return null;
		}
		if ( ctype_digit( $biz ) ) {
			$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$d} WHERE legacy_id = %s OR id = %d LIMIT 1", $biz, (int) $biz ), ARRAY_A );
		} else {
			$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$d} WHERE legacy_id = %s", $biz ), ARRAY_A );
		}
		return $row ? $row : null;
	}

	/** Prochaine position d'historique d'une commande. */
	private static function next_history_position( int $order_id ): int {
		global $wpdb;
		$osh = Bebba_HF_DB::order_status_history_table();
		return 1 + (int) $wpdb->get_var( $wpdb->prepare( "SELECT COALESCE(MAX(position), 0) FROM {$osh} WHERE order_id = %d", $order_id ) );
	}

	/** Écriture d'une entrée d'historique (mêmes colonnes/formats que create()). */
	private static function push_history( int $order_id, string $status, string $label, string $note, string $updated_by, string $now_ms ): void {
		global $wpdb;
		$wpdb->insert(
			Bebba_HF_DB::order_status_history_table(),
			array(
				'order_id'   => $order_id,
				'position'   => self::next_history_position( $order_id ),
				'status'     => $status,
				'label'      => $label,
				'timestamp'  => $now_ms,
				'note'       => $note,
				'updated_by' => $updated_by,
			),
			array( '%d', '%d', '%s', '%s', '%s', '%s', '%s' )
		);
	}

	/** GET /orders (admin|kitchen|driver) — portage server.ts l.674 : scoping par rôle, tri createdAt desc. */
	public static function list_for_staff( array $user ): array {
		global $wpdb;
		$o    = Bebba_HF_DB::orders_table();
		$role = (string) $user['role'];

		if ( 'driver' === $role ) {
			$my_driver = isset( $user['driverId'] ) ? (int) $user['driverId'] : 0;
			if ( ! $my_driver ) {
				return array();
			}
			$rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$o} WHERE driver_id = %d ORDER BY placed_at DESC, id DESC", $my_driver ), ARRAY_A );
		} elseif ( 'kitchen' === $role ) {
			// La cuisine voit tout sauf les commandes annulées (l.685-689).
			$rows = $wpdb->get_results( "SELECT * FROM {$o} WHERE status <> 'cancelled' ORDER BY placed_at DESC, id DESC", ARRAY_A );
		} else {
			$rows = $wpdb->get_results( "SELECT * FROM {$o} ORDER BY placed_at DESC, id DESC", ARRAY_A );
		}

		$out = array();
		foreach ( ( $rows ? $rows : array() ) as $r ) {
			$out[] = self::format_order_row( $r );
		}
		return $out;
	}

	/**
	 * PATCH /orders/:id/status (admin|kitchen|driver) — portage fidèle de
	 * server.ts l.1089-1171 + db.updateOrderStatus l.1491-1644. La transition
	 * à 'cancelled' restaure le stock dans la même transaction (spec §6.3).
	 */
	public static function update_status( string $biz_id, array $user, array $body ) {
		global $wpdb;

		$row = self::find_order_row( $biz_id );
		if ( ! $row ) {
			return self::fail( 'Commande non trouvée.', 404 );
		}

		$role = (string) $user['role'];

		/* IDOR : un livreur ne peut modifier que ses propres courses (l.1100-1105). */
		if ( 'driver' === $role ) {
			$my_driver = isset( $user['driverId'] ) ? (int) $user['driverId'] : 0;
			if ( ! $my_driver || (int) $row['driver_id'] !== $my_driver ) {
				return self::fail( 'Accès refusé : Cette commande ne vous est pas attribuée.', 403 );
			}
		}

		$status = trim( (string) ( $body['status'] ?? '' ) );
		if ( '' === $status ) {
			return self::fail( 'Le champ statut est requis.', 400 );
		}

		$current = (string) $row['status'];

		/* Idempotence : même statut -> renvoi sans effet de bord (l.1115-1118). */
		if ( $current === $status ) {
			return self::format_order_row( $row );
		}

		/* Matrice stricte côté serveur (l.1121-1126). */
		if ( ! self::is_valid_status_transition( $current, $status, $role ) ) {
			return self::fail(
				sprintf( "Transition interdite : Le rôle '%s' n'est pas autorisé à passer de '%s' à '%s'.", $role, $current, $status ),
				403
			);
		}

		/* Étiquette serveur-vérifiée de l'acteur (l.1128-1130). */
		$role_label = 'admin' === $role ? 'Admin' : ( 'kitchen' === $role ? 'Cuisine' : 'Livreur' );
		$updated_by = (string) $user['name'] . ' (' . $role_label . ')';
		$note       = isset( $body['note'] ) ? trim( (string) $body['note'] ) : '';

		/*
		 * Attribution livreur : SEUL l'admin, et SEULEMENT lors du passage à
		 * 'delivering' (l.1132-1133). Sinon le paramètre est totalement ignoré.
		 */
		$new_driver_biz = ( 'admin' === $role && 'delivering' === $status && isset( $body['assignedDriverId'] ) )
			? trim( (string) $body['assignedDriverId'] )
			: '';

		if ( 'delivering' === $status ) {
			if ( '' !== $new_driver_biz ) {
				$driver_biz = $new_driver_biz;
			} elseif ( '' !== (string) ( $row['driver_legacy_id'] ?? '' ) ) {
				$driver_biz = (string) $row['driver_legacy_id'];
			} else {
				$driver_biz = (string) ( $row['driver_id'] ?? '' );
			}
			if ( '' === $driver_biz || '0' === $driver_biz ) {
				return self::fail( "Une commande ne peut pas passer en cours de livraison sans attribution préalable d'un livreur.", 400 );
			}
			$driver = self::find_driver_row( $driver_biz );
			if ( ! $driver ) {
				return self::fail( sprintf( 'Livreur #%s introuvable.', $driver_biz ), 400 );
			}
			if ( (int) $driver['active'] !== 1 ) {
				return self::fail( sprintf( 'Le livreur "%s" est désactivé et ne peut pas recevoir de nouvelle commande.', (string) $driver['name'] ), 400 );
			}
		}

		$o = Bebba_HF_DB::orders_table();
		$d = Bebba_HF_DB::drivers_table();

		Bebba_HF_DB::begin();
		try {

			/* Relecture verrouillée : protège contre une transition concurrente. */
			$cur = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$o} WHERE id = %d FOR UPDATE", (int) $row['id'] ), ARRAY_A );
			if ( ! $cur ) {
				throw new Bebba_HF_Order_Exception( 'Commande non trouvée.', 404 );
			}
			if ( (string) $cur['status'] !== $current ) {
				throw new Bebba_HF_Order_Exception(
					sprintf( "Transition interdite : Le rôle '%s' n'est pas autorisé à passer de '%s' à '%s'.", $role, (string) $cur['status'], $status ),
					403
				);
			}

			$now    = Bebba_HF_DB::now();
			$now_ms = self::now_ms();

			$upd     = array();
			$upd_fmt = array();

			$upd['status'] = $status;
			$upd_fmt[]     = '%s';

			if ( 'delivering' === $status ) {
				/* Re-snapshot du livreur résolu (db.updateOrderStatus l.1536-1537). */
				$driver = self::find_driver_row( '' !== $new_driver_biz ? $new_driver_biz : (string) $cur['driver_id'] );
				if ( ! $driver ) {
					throw new Bebba_HF_Order_Exception( sprintf( 'Livreur #%s introuvable.', '' !== $new_driver_biz ? $new_driver_biz : (string) $cur['driver_id'] ), 400 );
				}
				$upd['driver_id']            = (int) $driver['id'];
				$upd_fmt[]                   = '%d';
				$upd['driver_legacy_id']     = (string) $driver['legacy_id'];
				$upd_fmt[]                   = '%s';
				$upd['driver_name_snapshot'] = (string) $driver['name'];
				$upd_fmt[]                   = '%s';
			}

			/* Restauration du stock à l'annulation (spec §6.3 — constat C2). */
			if ( 'cancelled' === $status && 1 === (int) $cur['stock_consumed'] ) {
				self::apply_stock_delta( (int) $cur['id'], (string) $cur['order_number'], (string) $cur['legacy_id'], 1, $updated_by, $now, 'order_cancellation_restore', 'Restauration stock annulation commande #' );
				$upd['stock_consumed'] = 0;
				$upd_fmt[]             = '%d';
			}

			/* Rétro-compatibilité : consommation à 'preparing' si pas déjà faite
			 * (l.1541-1588 — les commandes du plugin consomment déjà à la création,
			 * ce bloc ne sert qu'aux commandes migrées non consommées). */
			if ( 'preparing' === $status && 1 !== (int) $cur['stock_consumed'] ) {
				self::apply_stock_delta( (int) $cur['id'], (string) $cur['order_number'], (string) $cur['legacy_id'], -1, $updated_by, $now, 'order_consumption', 'Consommation préparation commande #' );
				$upd['stock_consumed'] = 1;
				$upd_fmt[]             = '%d';
			}

			if ( 'delivered' === $status && ! empty( $cur['driver_id'] ) ) {
				/* Compteur du livreur (l.1624-1632). */
				$wpdb->query( $wpdb->prepare( "UPDATE {$d} SET total_deliveries = total_deliveries + 1 WHERE id = %d", (int) $cur['driver_id'] ) );
			}

			if ( 'ready' === $status ) {
				/* Double transition automatique (l.1600-1620) : 'ready' puis
				 * 'waiting_for_driver' posé par le système. */
				self::push_history( (int) $cur['id'], 'ready', self::STATUS_LABELS['ready'], '' !== $note ? $note : 'Plats préparés et emballés en sac thermique', $updated_by, $now_ms );
				$upd['status'] = 'waiting_for_driver';
				self::push_history( (int) $cur['id'], 'waiting_for_driver', self::STATUS_LABELS['waiting_for_driver'], "Placée automatiquement en attente d'attribution d'un livreur", 'Système BEBBA', $now_ms );
			} else {
				self::push_history( (int) $cur['id'], $status, (string) ( self::STATUS_LABELS[ $status ] ?? $status ), $note, $updated_by, $now_ms );
			}

			$ok = $wpdb->update( $o, $upd, array( 'id' => (int) $cur['id'] ), $upd_fmt, array( '%d' ) );
			if ( false === $ok ) {
				throw new Bebba_HF_Order_Exception( 'Erreur interne lors de la mise à jour du statut.', 500 );
			}

			Bebba_HF_DB::commit();

			$fresh = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$o} WHERE id = %d", (int) $cur['id'] ), ARRAY_A );
			return $fresh ? self::format_order_row( $fresh ) : self::format_order_row( $cur );

		} catch ( Bebba_HF_Order_Exception $e ) {
			Bebba_HF_DB::rollback();
			return self::fail( $e->getMessage(), $e->status() );
		} catch ( Throwable $e ) {
			Bebba_HF_DB::rollback();
			return self::fail( 'Erreur interne.', 500 );
		}
	}

	/**
	 * Applique la consommation (-1) ou la restauration (+1) du stock d'une
	 * commande, avec écriture des mouvements correspondants, DANS la
	 * transaction appelante. Vérifie la disponibilité avant toute écriture.
	 */
	private static function apply_stock_delta( int $order_id, string $order_number, string $order_legacy, int $sign, string $performed_by, string $now, string $movement_type, string $note_prefix ): void {
		global $wpdb;
		$oip = Bebba_HF_DB::order_item_prep_table();
		$oi  = Bebba_HF_DB::order_items_table();
		$ing = Bebba_HF_DB::ingredients_table();
		$sm  = Bebba_HF_DB::stock_movements_table();

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT p.ingredient_id, p.ingredient_legacy_id, p.ingredient_name_snapshot, p.unit, SUM(p.total_quantity) AS need
				 FROM {$oip} p INNER JOIN {$oi} i ON i.id = p.order_item_id
				 WHERE i.order_id = %d AND p.ingredient_id IS NOT NULL
				 GROUP BY p.ingredient_id, p.ingredient_legacy_id, p.ingredient_name_snapshot, p.unit",
				$order_id
			),
			ARRAY_A
		);
		$rows = $rows ? $rows : array();

		/* Vérification de la disponibilité AVANT toute écriture (l.1569-1573). */
		if ( -1 === $sign ) {
			foreach ( $rows as $r ) {
				$have = (float) $wpdb->get_var( $wpdb->prepare( "SELECT stock_quantity FROM {$ing} WHERE id = %d", (int) $r['ingredient_id'] ) );
				if ( $have < (float) $r['need'] ) {
					throw new Bebba_HF_Order_Exception( sprintf( "Stock insuffisant pour l'ingrédient %s.", (string) $r['ingredient_name_snapshot'] ), 400 );
				}
			}
		}

		foreach ( $rows as $r ) {
			$need    = self::round1( (float) $r['need'] );
			$delta   = $sign * $need;
			$ing_row = $wpdb->get_row( $wpdb->prepare( "SELECT id, legacy_id, name, unit FROM {$ing} WHERE id = %d", (int) $r['ingredient_id'] ), ARRAY_A );
			if ( ! $ing_row ) {
				continue;
			}
			$wpdb->query(
				$wpdb->prepare(
					"UPDATE {$ing} SET stock_quantity = stock_quantity + %s, updated_at = %s WHERE id = %d",
					number_format( $delta, 2, '.', '' ),
					$now,
					(int) $ing_row['id']
				)
			);
			$wpdb->insert(
				$sm,
				array(
					'legacy_id'                => 'mov-' . (string) (int) round( microtime( true ) * 1000 ) . '-' . self::rand_hex( 4 ),
					'ingredient_id'            => (int) $ing_row['id'],
					'ingredient_legacy_id'     => (string) $ing_row['legacy_id'],
					'ingredient_name_snapshot' => (string) $ing_row['name'],
					'movement_type'            => $movement_type,
					'quantity'                 => $delta,
					'unit'                     => (string) ( $r['unit'] ?? $ing_row['unit'] ?? 'g' ),
					'order_id'                 => $order_id,
					'order_legacy_id'          => $order_legacy,
					'order_number_snapshot'    => $order_number,
					'notes'                    => $note_prefix . $order_number,
					'performed_by'             => '' !== $performed_by ? $performed_by : 'Cuisine BEBBA',
					'timestamp'                => $now,
				),
				array( '%s', '%d', '%s', '%s', '%s', '%f', '%s', '%d', '%s', '%s', '%s', '%s', '%s' )
			);
		}
	}

	/** PATCH /orders/:id/assign-driver (admin) — portage server.ts l.1174-1188 + db.assignDriver l.1646-1677. */
	public static function assign_driver( string $biz_id, array $body, array $user ) {
		global $wpdb;

		/* Express accepte driverId OU assignedDriverId (l.1177). */
		$driver_biz = trim( (string) ( $body['driverId'] ?? '' ) );
		if ( '' === $driver_biz ) {
			$driver_biz = trim( (string) ( $body['assignedDriverId'] ?? '' ) );
		}
		if ( '' === $driver_biz ) {
			return self::fail( 'L’identifiant du livreur (driverId) est requis.', 400 );
		}

		/* Express : toutes les erreurs de cette route sortent en 400 (catch l.1186). */
		$row = self::find_order_row( $biz_id );
		if ( ! $row ) {
			return self::fail( sprintf( 'Commande #%s introuvable.', $biz_id ), 400 );
		}
		$status = (string) $row['status'];
		if ( 'delivered' === $status || 'cancelled' === $status ) {
			return self::fail( 'Impossible de modifier l’affectation d’une commande clôturée ou annulée.', 400 );
		}
		$driver = self::find_driver_row( $driver_biz );
		if ( ! $driver ) {
			return self::fail( sprintf( 'Livreur #%s introuvable.', $driver_biz ), 400 );
		}
		if ( (int) $driver['active'] !== 1 ) {
			return self::fail( sprintf( 'Le livreur "%s" est désactivé et ne peut pas recevoir de nouvelle commande.', (string) $driver['name'] ), 400 );
		}

		$o = Bebba_HF_DB::orders_table();

		Bebba_HF_DB::begin();
		try {
			$ok = $wpdb->update(
				$o,
				array(
					'driver_id'            => (int) $driver['id'],
					'driver_legacy_id'     => (string) $driver['legacy_id'],
					'driver_name_snapshot' => (string) $driver['name'],
				),
				array( 'id' => (int) $row['id'] ),
				array( '%d', '%s', '%s' ),
				array( '%d' )
			);
			if ( false === $ok ) {
				throw new Bebba_HF_Order_Exception( 'Erreur interne lors de l’affectation du livreur.', 500 );
			}
			self::push_history(
				(int) $row['id'],
				$status,
				'Livreur affecté : ' . (string) $driver['name'],
				"Affectation livreur mise à jour par l'administrateur",
				(string) $user['name'] . ' (Admin)',
				self::now_ms()
			);
			Bebba_HF_DB::commit();
		} catch ( Bebba_HF_Order_Exception $e ) {
			Bebba_HF_DB::rollback();
			return self::fail( $e->getMessage(), $e->status() );
		} catch ( Throwable $e ) {
			Bebba_HF_DB::rollback();
			return self::fail( 'Erreur interne.', 500 );
		}

		$fresh = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$o} WHERE id = %d", (int) $row['id'] ), ARRAY_A );
		return $fresh ? self::format_order_row( $fresh ) : self::format_order_row( $row );
	}

	/**
	 * PATCH /orders/:id/payment — portage server.ts l.1191-1252 : cascade 403
	 * explicite (client / cuisine / lecture-seule / autre), encaissement
	 * 'paid' uniquement sur une commande livrée, livreur restreint à 'paid'
	 * sur SES propres courses.
	 */
	public static function update_payment( string $biz_id, array $user, array $body ) {
		global $wpdb;

		$row = self::find_order_row( $biz_id );
		if ( ! $row ) {
			return self::fail( 'Commande non trouvée.', 404 );
		}

		$role = (string) $user['role'];

		if ( 'client' === $role ) {
			return self::fail( 'Accès refusé : Les clients ne sont pas autorisés à modifier le statut de paiement.', 403 );
		}
		if ( 'kitchen' === $role ) {
			return self::fail( 'Accès refusé : La cuisine n’a pas l’autorisation de modifier le statut de paiement.', 403 );
		}
		if ( 'admin_readonly' === $role ) {
			return self::fail( 'Accès refusé : Lecture seule, modification du paiement interdite.', 403 );
		}
		if ( 'admin' !== $role && 'driver' !== $role ) {
			return self::fail( 'Accès refusé : Vous n’avez pas l’autorisation de modifier le statut de paiement.', 403 );
		}

		$payment_status = trim( (string) ( $body['paymentStatus'] ?? '' ) );
		if ( '' === $payment_status || ! in_array( $payment_status, array( 'paid', 'to_collect' ), true ) ) {
			return self::fail( 'Statut de paiement invalide.', 400 );
		}
		if ( 'paid' === $payment_status && 'delivered' !== (string) $row['status'] ) {
			return self::fail( "Impossible d'encaisser une commande qui n'est pas encore livrée.", 400 );
		}
		if ( 'driver' === $role ) {
			$my_driver = isset( $user['driverId'] ) ? (int) $user['driverId'] : 0;
			if ( ! $my_driver || (int) $row['driver_id'] !== $my_driver ) {
				return self::fail( 'Accès refusé : Cette commande ne vous est pas attribuée.', 403 );
			}
			if ( 'paid' !== $payment_status ) {
				return self::fail( 'Le livreur peut uniquement enregistrer le paiement reçu (paid).', 400 );
			}
		}

		$o = Bebba_HF_DB::orders_table();

		Bebba_HF_DB::begin();
		try {
			$ok = $wpdb->update( $o, array( 'payment_status' => $payment_status ), array( 'id' => (int) $row['id'] ), array( '%s' ), array( '%d' ) );
			if ( false === $ok ) {
				throw new Bebba_HF_Order_Exception( 'Erreur interne lors de la mise à jour du paiement.', 500 );
			}
			Bebba_HF_DB::commit();
		} catch ( Bebba_HF_Order_Exception $e ) {
			Bebba_HF_DB::rollback();
			return self::fail( $e->getMessage(), $e->status() );
		} catch ( Throwable $e ) {
			Bebba_HF_DB::rollback();
			return self::fail( 'Erreur interne.', 500 );
		}

		$fresh = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$o} WHERE id = %d", (int) $row['id'] ), ARRAY_A );
		return $fresh ? self::format_order_row( $fresh ) : self::format_order_row( $row );
	}
}
