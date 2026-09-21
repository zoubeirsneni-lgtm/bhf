<?php
/**
 * BEBBA — Harnais de test automatique du LOT 3 (plugin v0.3.1 — harnais rev 2)
 *
 * À COPIER dans la racine WordPress (C:\wamp64\www\bebbabhf\) puis ouvrir :
 *   http://localhost/bebbabhf/bebba-test-lot3.php
 *
 * ⚠️ FICHIER TEMPORAIRE DE TEST : à SUPPRIMER après usage.
 * ⚠️ Chaque exécution crée 3 commandes + 1 compte client de démonstration (compteur + stock).
 *
 * Couvre : création transactionnelle, recalcul serveur des prix, substitution de base,
 * idempotence (201/200/403/422), validations, compteurs, stock + mouvements,
 * client authentifié (historique, IDOR), suivi public, isolation wp_users.
 *
 * rev 2 : fix T2d — le harnais cherchait des libellés accentués dans la sortie
 * de wp_json_encode (qui échappe en \u00e9) → strpos impossible. Encodage unique
 * avec JSON_UNESCAPED_UNICODE. Aucune modification du plugin (déjà conforme).
 */

if ( ! defined( 'ABSPATH' ) ) {
	require __DIR__ . '/wp-load.php';
}

header( 'Content-Type: text/html; charset=utf-8' );
echo '<pre style="font-size:13px;line-height:1.5">';

$results = array();
function bebba_test( string $label, bool $pass, string $detail = '' ): void {
	global $results;
	$results[] = array( $label, $pass, $detail );
	echo ( $pass ? '[PASS] ' : '[FAIL] ' ) . $label . ( '' !== $detail && ! $pass ? "\n       -> " . $detail : '' ) . "\n";
}

/**
 * Appel HTTP REST local. Retour : [code, body_decode].
 */
function bebba_http( string $method, string $path, ?array $payload = null, array $headers = array() ): array {
	$base = untrailingslashit( get_option( 'siteurl' ) );
	$args = array(
		'method'  => $method,
		'timeout' => 30,
		'headers' => $headers,
	);
	if ( null !== $payload ) {
		$args['headers']['Content-Type'] = 'application/json';
		$args['body']                    = wp_json_encode( $payload );
	}
	$res  = wp_remote_request( $base . '/wp-json/bebba/v1' . $path, $args );
	$code = is_wp_error( $res ) ? 0 : (int) wp_remote_retrieve_response_code( $res );
	$body = is_wp_error( $res ) ? null : json_decode( wp_remote_retrieve_body( $res ), true );
	return array( $code, $body );
}

function bebba_stock( string $legacy ): float {
	global $wpdb;
	return (float) $wpdb->get_var( $wpdb->prepare(
		'SELECT stock_quantity FROM ' . Bebba_HF_DB::ingredients_table() . ' WHERE legacy_id = %s',
		$legacy
	) );
}

function bebba_counter(): int {
	global $wpdb;
	return (int) $wpdb->get_var(
		'SELECT current_value FROM ' . Bebba_HF_DB::counters_table() . " WHERE counter_name = 'orders'"
	);
}

global $wpdb;
$wp_users_before = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . $wpdb->users );

echo "=== BEBBA TESTS LOT 3 (plugin " . esc_html( BEBBA_HF_VERSION ) . ") ===\n\n";

/* ---------------------------------------------------------------- T1 health */
list( $code, $body ) = bebba_http( 'GET', '/health' );
bebba_test( 'T1 health version 0.3.1', 200 === $code && '0.3.1' === (string) ( $body['version'] ?? '' ), "code=$code body=" . wp_json_encode( $body ) );

/* ------------------------------------------------------- T2 commande invitée */
$guest = array(
	'client' => array(
		'name'            => 'Zoubeir Test',
		'phone'           => '+216 22 333 444',
		'deliveryAddress' => '12 rue du Lac, Tunis',
		'notes'           => 'Sans oignons',
	),
	'items'  => array(
		array(
			'productId'           => 'prod-chicken-bowl',
			'quantity'            => 1,
			'proteinOption'       => array( 'label' => 'Portion sportive (+100g)' ),
			'veggiesOption'       => array( 'label' => 'Double légumes (+50g)' ),
			'baseChoice'          => array( 'label' => 'Base quinoa' ),
			'supplements'         => array( array( 'id' => 'sup-poulet-extra', 'quantity' => 1 ) ),
			'specialInstructions' => 'Bien croustillant',
		),
	),
);

$stocks_before = array(
	'ing-poulet'       => bebba_stock( 'ing-poulet' ),
	'ing-legumes'      => bebba_stock( 'ing-legumes' ),
	'ing-riz'          => bebba_stock( 'ing-riz' ),
	'ing-quinoa'       => bebba_stock( 'ing-quinoa' ),
	'ing-sauce-yaourt' => bebba_stock( 'ing-sauce-yaourt' ),
);

list( $code, $order ) = bebba_http( 'POST', '/orders', $guest );
bebba_test( 'T2 commande invitée → 201', 201 === $code, "code=$code body=" . wp_json_encode( $order ) );

$guest_legacy = (string) ( $order['id'] ?? '' );
$guest_number = (string) ( $order['orderNumber'] ?? '' );
$guest_token  = (string) ( $order['trackingToken'] ?? '' );

$ok_num   = 201 === $code && 1 === preg_match( '/^BEBBA-\d+$/', $guest_number );
$ok_token = 201 === $code && 1 === preg_match( '/^tk_[0-9a-f]{12}$/', $guest_token ); // contrat d'origine : randomBytes(6) = 12 hexa.
$ok_price = 201 === $code && abs( (float) ( $order['subtotal'] ?? 0 ) - 23.5 ) < 0.01
	&& abs( (float) ( $order['totalAmount'] ?? 0 ) - 26.0 ) < 0.01
	&& abs( (float) ( $order['deliveryFee'] ?? 0 ) - 2.5 ) < 0.01;
$ok_item  = 201 === $code && 1 === count( (array) ( $order['items'] ?? array() ) )
	&& abs( (float) ( $order['items'][0]['unitPrice'] ?? 0 ) - 23.5 ) < 0.01
	&& 'Portion sportive (+100g)' === (string) ( $order['items'][0]['proteinOption']['label'] ?? '' )
	&& 'Base quinoa' === (string) ( $order['items'][0]['baseChoice']['label'] ?? '' );
// rev 2 : encodage UNE fois en UTF-8 littéral — wp_json_encode échappe les accents
// (ex. L\u00e9gumes) et strpos ne trouvait jamais 'Légumes frais: 130 g' (bug T2d harnais).
$order_json = wp_json_encode( $order, JSON_UNESCAPED_UNICODE );
$ok_lines = 201 === $code
	&& false !== strpos( $order_json, 'Poulet fermier: 350 g' )
	&& false !== strpos( $order_json, 'Légumes frais: 130 g' )
	&& false !== strpos( $order_json, 'Quinoa royal aux graines: 100 g' )
	&& false !== strpos( $order_json, 'Sauce yaourt: 30 ml' )
	&& false !== strpos( $order_json, 'NOTE CLIENT' );
$ok_meta  = 201 === $code && 'received' === (string) ( $order['status'] ?? '' ) && true === ( $order['stockConsumed'] ?? null )
	&& array_key_exists( 'clientId', (array) $order ) && null === $order['clientId'] // NB : ?? false casse sur une valeur null (sémantique isset).
	&& 'to_collect' === (string) ( $order['paymentStatus'] ?? '' )
	&& 'Commande reçue & transmise à la cuisine' === (string) ( $order['statusHistory'][0]['label'] ?? '' )
	&& 'Système Client' === (string) ( $order['statusHistory'][0]['updatedBy'] ?? '' );

bebba_test( 'T2a numéro BEBBA-#### et token tk_...', $ok_num && $ok_token, "num=$guest_number token=$guest_token" );
bebba_test( 'T2b prix serveur (23.5 + 2.5 = 26)', $ok_price, wp_json_encode( array( 'subtotal' => $order['subtotal'] ?? null, 'total' => $order['totalAmount'] ?? null ) ) );
bebba_test( 'T2c item + options résolues serveur', $ok_item, wp_json_encode( $order['items'][0] ?? null ) );
bebba_test( 'T2d fiche de préparation (350g poulet, substitution quinoa...)', $ok_lines, wp_json_encode( $order['items'][0]['preparationSheet'] ?? null, JSON_UNESCAPED_UNICODE ) );
bebba_test( 'T2e statuts + clientId null (invité)', $ok_meta, wp_json_encode( $order ) );

/* --------------------------------------------------------------- T3 stock */
$expected_delta = array(
	'ing-poulet'       => -350.0, // 150 base + 100 option sportive + 100 supplément
	'ing-legumes'      => -130.0, // 80 base + 50 option double
	'ing-riz'          => 0.0,    // remplacé par le quinoa
	'ing-quinoa'       => -100.0, // substitution de base
	'ing-sauce-yaourt' => -30.0,
);
$stock_ok   = true;
$stock_info = array();
foreach ( $expected_delta as $legacy => $delta ) {
	$after = bebba_stock( $legacy );
	$diff  = round( $after - $stocks_before[ $legacy ], 1 );
	$stock_info[] = "$legacy: " . $stocks_before[ $legacy ] . ' -> ' . $after;
	if ( abs( $diff - $delta ) > 0.01 ) {
		$stock_ok = false;
	}
}
bebba_test( 'T3 décrément stock exact (−350/−130/0/−100/−30)', $stock_ok, implode( ' | ', $stock_info ) );

list( $code, $pub ) = bebba_http( 'GET', '/orders/track/' . rawurlencode( $guest_token ) );
bebba_test( 'T3b suivi public par token → 200', 200 === $code, "code=$code" );

$mov_count = (int) $wpdb->get_var( $wpdb->prepare(
	'SELECT COUNT(*) FROM ' . Bebba_HF_DB::stock_movements_table() . ' WHERE order_legacy_id = %s',
	$guest_legacy
) );
bebba_test( 'T3c 4 mouvements de stock order_consumption', 4 === $mov_count, "trouvés=$mov_count" );

/* ----------------------------------------------------------- T4 idempotence */
$idem_key = 'test-key-' . uniqid();

list( $code1, $order1 ) = bebba_http( 'POST', '/orders', $guest, array( 'Idempotency-Key' => $idem_key ) );
$num1 = (string) ( $order1['orderNumber'] ?? '' );
$st1  = bebba_stock( 'ing-poulet' );

list( $code2, $order2 ) = bebba_http( 'POST', '/orders', $guest, array( 'Idempotency-Key' => $idem_key ) );
$num2 = (string) ( $order2['orderNumber'] ?? '' );
$st2  = bebba_stock( 'ing-poulet' );

bebba_test( 'T4a 1re émission avec clé → 201', 201 === $code1, "code=$code1" );
bebba_test( 'T4b rejeu avec la même clé → 200, même numéro', 200 === $code2 && '' !== $num1 && $num1 === $num2, "code2=$code2 num1=$num1 num2=$num2" );
bebba_test( 'T4c aucun double décrément de stock', abs( $st2 - $st1 ) < 0.01, "avant=$st1 après=$st2" );

$key_rows = (int) $wpdb->get_var( $wpdb->prepare(
	'SELECT COUNT(*) FROM ' . Bebba_HF_DB::order_idempotency_table() . ' WHERE idempotency_key = %s',
	$idem_key
) );
bebba_test( "T4d une seule ligne d'idempotence en base", 1 === $key_rows, "trouvées=$key_rows" );

/* --------------------------------------------------- T5/T6 conflits d'idempotence */
$other_caller                    = $guest;
$other_caller['client']['phone'] = '+216 99 888 777';
list( $code, $err ) = bebba_http( 'POST', '/orders', $other_caller, array( 'Idempotency-Key' => $idem_key ) );
bebba_test( 'T5 même clé + autre émetteur → 403', 403 === $code, "code=$code body=" . wp_json_encode( $err ) );

$modified                   = $guest;
$modified['client']['name'] = 'Zoubeir Modifié';
list( $code, $err ) = bebba_http( 'POST', '/orders', $modified, array( 'Idempotency-Key' => $idem_key ) );
bebba_test( 'T6 même clé + contenu différent → 422', 422 === $code, "code=$code body=" . wp_json_encode( $err ) );

/* ---------------------------------------------------------- T7-T11 validations */
$bad         = $guest;
$bad['items'] = array();
list( $code, $err ) = bebba_http( 'POST', '/orders', $bad );
bebba_test( 'T7 panier vide → 400 "Le panier est vide."', 400 === $code && 'Le panier est vide.' === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

$bad = array(
	'client' => array( 'name' => 'X', 'phone' => '22333444' ),
	'items'  => $guest['items'],
);
list( $code, $err ) = bebba_http( 'POST', '/orders', $bad );
bebba_test( 'T8 adresse manquante → 400', 400 === $code && isset( $err['error'] ), "code=$code body=" . wp_json_encode( $err ) );

$bad = $guest;
$bad['items'][0]['productId'] = 'inconnu';
list( $code, $err ) = bebba_http( 'POST', '/orders', $bad );
bebba_test( 'T9 produit inconnu → 400', 400 === $code && false !== strpos( (string) ( $err['error'] ?? '' ), 'Produit #inconnu introuvable.' ), "code=$code body=" . wp_json_encode( $err ) );

$bad = $guest;
$bad['items'][0]['proteinOption'] = array( 'label' => 'Option pirate' );
list( $code, $err ) = bebba_http( 'POST', '/orders', $bad );
bebba_test( 'T10 option pirate → 400', 400 === $code && false !== strpos( (string) ( $err['error'] ?? '' ), 'pas autorisée pour le plat "Poulet Bowl"' ), "code=$code body=" . wp_json_encode( $err ) );

$bad = $guest;
$bad['items'][0]['quantity'] = 150;
list( $code, $err ) = bebba_http( 'POST', '/orders', $bad );
bebba_test( 'T11 quantité 150 → 400', 400 === $code && false !== strpos( (string) ( $err['error'] ?? '' ), '(reçu: 150)' ), "code=$code body=" . wp_json_encode( $err ) );

/* ----------------------------------------------------- T12-T16 client authentifié */
$client_phone = '216' . random_int( 10000000, 99999999 );
list( $code, $reg ) = bebba_http( 'POST', '/auth/register-client', array(
	'name'     => 'Client Test ' . random_int( 100, 999 ),
	'phone'    => $client_phone,
	'password' => 'secret123',
) );
bebba_test( 'T12 inscription client → 201 + token', 201 === $code && ! empty( $reg['token'] ) && 'client' === (string) ( $reg['user']['role'] ?? '' ), "code=$code body=" . wp_json_encode( $reg ) );

$token   = (string) ( $reg['token'] ?? '' );
$auth    = array( 'Authorization' => 'Bearer ' . $token );
$user_id = (string) ( $reg['user']['id'] ?? '' );

$own = array(
	'client' => array(
		'name'            => (string) ( $reg['user']['name'] ?? 'Client' ),
		'phone'           => '+' . $client_phone,
		'deliveryAddress' => '45 avenue Habib Bourguiba, Sousse',
	),
	'items'  => array(
		array( 'productId' => 'prod-chicken-bowl', 'quantity' => 2 ),
	),
);
list( $code, $order3 ) = bebba_http( 'POST', '/orders', $own, $auth );
$num3 = (string) ( $order3['orderNumber'] ?? '' );
bebba_test( 'T13 commande authentifiée → 201 + clientId rempli', 201 === $code && $user_id === (string) ( $order3['clientId'] ?? '' ) && abs( (float) ( $order3['totalAmount'] ?? 0 ) - 31.5 ) < 0.01, "code=$code clientId=" . wp_json_encode( $order3['clientId'] ?? null ) . " total=" . wp_json_encode( $order3['totalAmount'] ?? null ) );

list( $code, $list ) = bebba_http( 'GET', '/client/orders', null, $auth );
$found = false;
foreach ( ( array) ( $list ?? array() ) as $lo ) {
	if ( (string) ( $lo['id'] ?? '' ) === (string) ( $order3['id'] ?? '-' ) ) {
		$found = true;
	}
}
bebba_test( 'T14 GET /client/orders → historique contient la commande', 200 === $code && $found && is_array( $list ) && count( $list ) >= 1, "code=$code n=" . ( is_array( $list ) ? count( $list ) : -1 ) );

list( $code, $got ) = bebba_http( 'GET', '/orders/' . rawurlencode( (string) ( $order3['id'] ?? '' ) ), null, $auth );
bebba_test( 'T15 GET /orders/{id} (sienne) → 200', 200 === $code && (string) ( $got['id'] ?? '' ) === (string) ( $order3['id'] ?? '' ), "code=$code" );

list( $code, $err ) = bebba_http( 'GET', '/orders/' . rawurlencode( $guest_legacy ), null, $auth );
bebba_test( 'T16 IDOR : commande invité vue par un autre client → 403', 403 === $code, "code=$code body=" . wp_json_encode( $err ) );

list( $code, $err ) = bebba_http( 'GET', '/orders/' . rawurlencode( $guest_legacy ) );
bebba_test( 'T17 sans token → 401', 401 === $code, "code=$code" );

/* ------------------------------------------------------- T18-T19 suivi public */
list( $code, $pub ) = bebba_http( 'POST', '/orders/track-lookup', array(
	'orderNumber' => $guest_number,
	'phone'       => '22 333 444',
) );
bebba_test( 'T18 track-lookup (numéro + téléphone) → 200', 200 === $code && (string) ( $pub['orderNumber'] ?? '' ) === $guest_number, "code=$code body=" . wp_json_encode( $pub ) );

/* ---------------------------------------------------- T20 compteurs + isolation */
$counter = bebba_counter();
bebba_test( 'T20 compteur orders = numéro de la dernière commande', $counter > 0 && 'BEBBA-' . $counter === $num3, "compteur=$counter num3=$num3" );

$wp_users_after = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . $wpdb->users );
bebba_test( 'T21 isolation : wp_users inchangé', $wp_users_before === $wp_users_after, "avant=$wp_users_before après=$wp_users_after" );

/* ---------------------------------------------------------------- résumé */
$pass = 0;
$fail = 0;
foreach ( $results as $r ) {
	if ( $r[1] ) {
		$pass++;
	} else {
		$fail++;
	}
}
echo "\n=== RÉSULTAT : $pass PASS / $fail FAIL ===\n";
echo 0 === $fail
	? ">>> TOUT EST VALIDÉ. Vous pouvez SUPPRIMER ce fichier (bebba-test-lot3.php).\n"
	: ">>> Envoyez TOUT le texte ci-dessus à Super Z pour correction.\n";
echo '</pre>';
