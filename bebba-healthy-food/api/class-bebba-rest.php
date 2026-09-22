<?php
/**
 * REST API bebba — namespace /wp-json/bebba/v1
 *
 * PHASE 0 : routes health + auth (fonctionnelles dans ce squelette).
 * PHASES 2-5 : completer selon la cartographie de la spec (section 5) — voir CARTE DES ROUTES ci-dessous.
 *
 * Contrat de relecture :
 * - CHAQUE route declare un permission_callback explicite (jamais __return_true sur une route protegee).
 * - Les routes protegees utilisent Bebba_HF_Auth::require_role( array( ...roles... ) ).
 * - Les entrees sont sanitisees ; les reponses n'exposent jamais password_hash.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bebba_HF_Rest {

	const NAMESPACE_V1 = 'bebba/v1';

	public static function register_routes(): void {

		/* ------------------------------------------------ health (public) */
		register_rest_route(
			self::NAMESPACE_V1,
			'/health',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => '__return_true', // Route de diagnostic, volontairement publique.
				'callback'            => array( __CLASS__, 'health' ),
			)
		);

		/* ------------------------------------------------ auth (public + roles) */
		register_rest_route(
			self::NAMESPACE_V1,
			'/auth/login',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'permission_callback' => '__return_true', // Public, protege par anti-force-brute.
				'callback'            => array( __CLASS__, 'login' ),
				'args'                => array(
					// Contrat Express d'origine : {username?, phone?, password}
					// (server.ts l.81-106). identifier/mode restent acceptes en
					// extension plugin mais ne sont PAS requis : le handler de
					// compatibilite doit rester atteignable (fix LOT 4 v0.4.1).
					'identifier' => array( 'type' => 'string' ),
					'password'   => array( 'required' => true, 'type' => 'string' ),
					'mode'       => array( 'type' => 'string', 'enum' => array( 'client', 'staff' ) ),
					'username'   => array( 'type' => 'string' ),
					'phone'      => array( 'type' => 'string' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/auth/register-client',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'permission_callback' => '__return_true', // Public, throttle applicatif a ajouter en Phase 1.
				'callback'            => array( __CLASS__, 'register_client' ),
				'args'                => array(
					'name'     => array( 'required' => true, 'type' => 'string' ),
					'phone'    => array( 'required' => true, 'type' => 'string' ),
					'password' => array( 'required' => true, 'type' => 'string' ),
					'address'  => array( 'required' => false, 'type' => 'string' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/auth/me',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => function () {
					return Bebba_HF_Auth::require_role( Bebba_HF_Auth::ROLES );
				},
				'callback'            => array( __CLASS__, 'me' ),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/auth/logout',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'permission_callback' => function () {
					return Bebba_HF_Auth::require_role( Bebba_HF_Auth::ROLES );
				},
				'callback'            => array( __CLASS__, 'logout' ),
			)
		);

		/* ------------------------------------------------ change-password (authenticated) */
		register_rest_route(
			self::NAMESPACE_V1,
			'/auth/change-password',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'permission_callback' => function () {
					return Bebba_HF_Auth::require_role( Bebba_HF_Auth::ROLES );
				},
				'callback'            => array( __CLASS__, 'change_password' ),
				'args'                => array(
					'currentPassword' => array( 'required' => true, 'type' => 'string' ),
					'newPassword'     => array( 'required' => true, 'type' => 'string' ),
				),
			)
		);

		/* ------------------------------------------------ phase 2 : catalogue public (LOT 2) */
		register_rest_route(
			self::NAMESPACE_V1,
			'/categories',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => '__return_true',
				'callback'            => array( __CLASS__, 'categories_list' ),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/categories/(?P<id>[A-Za-z0-9_-]+)',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => '__return_true',
				'callback'            => array( __CLASS__, 'categories_get' ),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/products',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => '__return_true',
				'callback'            => array( __CLASS__, 'products_list' ),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/products/(?P<id>[A-Za-z0-9_-]+)',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => '__return_true',
				'callback'            => array( __CLASS__, 'products_get' ),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/supplements',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => '__return_true',
				'callback'            => array( __CLASS__, 'supplements_list' ),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/supplements/(?P<id>[A-Za-z0-9_-]+)',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => '__return_true',
				'callback'            => array( __CLASS__, 'supplements_get' ),
			)
		);

		/* ------------------------------------------------ phase 2 : suivi public (LOT 2) */
		register_rest_route(
			self::NAMESPACE_V1,
			'/orders/track/(?P<token>[A-Za-z0-9_-]+)',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => '__return_true',
				'callback'            => array( __CLASS__, 'track_by_token' ),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/orders/track',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => '__return_true',
				'callback'            => array( __CLASS__, 'track_by_query' ),
			)
		);

	
		/* ------------------------------------------------ admin (LOT 4) */

		register_rest_route(
			self::NAMESPACE_V1,
			'/categories',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'permission_callback' => function () {
					return Bebba_HF_Auth::require_role( array( 'admin' ) );
				},
				'callback'            => array( __CLASS__, 'admin_categories_create' ),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/categories/(?P<id>[^/]+)',
			array(
				array(
					'methods'             => 'PUT',
					'permission_callback' => function () {
						return Bebba_HF_Auth::require_role( array( 'admin' ) );
					},
					'callback'            => array( __CLASS__, 'admin_categories_update' ),
				),
				array(
					'methods'             => WP_REST_Server::DELETABLE,
					'permission_callback' => function () {
						return Bebba_HF_Auth::require_role( array( 'admin' ) );
					},
					'callback'            => array( __CLASS__, 'admin_categories_delete' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/products',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'permission_callback' => function () {
					return Bebba_HF_Auth::require_role( array( 'admin' ) );
				},
				'callback'            => array( __CLASS__, 'admin_products_create' ),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/products/(?P<id>[^/]+)',
			array(
				array(
					'methods'             => 'PUT',
					'permission_callback' => function () {
						return Bebba_HF_Auth::require_role( array( 'admin' ) );
					},
					'callback'            => array( __CLASS__, 'admin_products_update' ),
				),
				array(
					'methods'             => WP_REST_Server::DELETABLE,
					'permission_callback' => function () {
						return Bebba_HF_Auth::require_role( array( 'admin' ) );
					},
					'callback'            => array( __CLASS__, 'admin_products_delete' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/supplements',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'permission_callback' => function () {
					return Bebba_HF_Auth::require_role( array( 'admin' ) );
				},
				'callback'            => array( __CLASS__, 'admin_supplements_create' ),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/supplements/(?P<id>[^/]+)',
			array(
				array(
					'methods'             => 'PUT',
					'permission_callback' => function () {
						return Bebba_HF_Auth::require_role( array( 'admin' ) );
					},
					'callback'            => array( __CLASS__, 'admin_supplements_update' ),
				),
				array(
					'methods'             => WP_REST_Server::DELETABLE,
					'permission_callback' => function () {
						return Bebba_HF_Auth::require_role( array( 'admin' ) );
					},
					'callback'            => array( __CLASS__, 'admin_supplements_delete' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/ingredients',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'permission_callback' => function () {
						return Bebba_HF_Auth::require_role( array( 'admin', 'kitchen' ) );
					},
					'callback'            => array( __CLASS__, 'admin_ingredients_list' ),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'permission_callback' => function () {
						return Bebba_HF_Auth::require_role( array( 'admin', 'kitchen' ) );
					},
					'callback'            => array( __CLASS__, 'admin_ingredients_create' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/ingredients/(?P<id>[^/]+)',
			array(
				array(
					'methods'             => 'PUT',
					'permission_callback' => function () {
						return Bebba_HF_Auth::require_role( array( 'admin', 'kitchen' ) );
					},
					'callback'            => array( __CLASS__, 'admin_ingredients_update' ),
				),
				array(
					'methods'             => WP_REST_Server::DELETABLE,
					'permission_callback' => function () {
						return Bebba_HF_Auth::require_role( array( 'admin' ) );
					},
					'callback'            => array( __CLASS__, 'admin_ingredients_delete' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/ingredients/(?P<id>[^/]+)/stock',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'permission_callback' => function () {
					return Bebba_HF_Auth::require_role( array( 'admin', 'kitchen' ) );
				},
				'callback'            => array( __CLASS__, 'admin_ingredients_stock' ),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/stock-movements',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => function () {
					return Bebba_HF_Auth::require_role( array( 'admin', 'admin_readonly' ) );
				},
				'callback'            => array( __CLASS__, 'admin_stock_movements_list' ),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/drivers',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'permission_callback' => function () {
						return Bebba_HF_Auth::require_role( array( 'admin', 'kitchen' ) );
					},
					'callback'            => array( __CLASS__, 'admin_drivers_list' ),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'permission_callback' => function () {
						return Bebba_HF_Auth::require_role( array( 'admin' ) );
					},
					'callback'            => array( __CLASS__, 'admin_drivers_create' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/drivers/(?P<id>[^/]+)',
			array(
				array(
					'methods'             => 'PUT',
					'permission_callback' => function () {
						return Bebba_HF_Auth::require_role( array( 'admin' ) );
					},
					'callback'            => array( __CLASS__, 'admin_drivers_update' ),
				),
				array(
					'methods'             => WP_REST_Server::DELETABLE,
					'permission_callback' => function () {
						return Bebba_HF_Auth::require_role( array( 'admin' ) );
					},
					'callback'            => array( __CLASS__, 'admin_drivers_delete' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/drivers/(?P<id>[^/]+)/status',
			array(
				'methods'             => 'PATCH',
				'permission_callback' => function () {
					return Bebba_HF_Auth::require_role( array( 'admin' ) );
				},
				'callback'            => array( __CLASS__, 'admin_drivers_status' ),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/drivers/(?P<id>[^/]+)/password',
			array(
				'methods'             => 'PATCH',
				'permission_callback' => function () {
					return Bebba_HF_Auth::require_role( array( 'admin' ) );
				},
				'callback'            => array( __CLASS__, 'admin_drivers_password' ),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/suppliers',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'permission_callback' => function () {
						return Bebba_HF_Auth::require_role( array( 'admin' ) );
					},
					'callback'            => array( __CLASS__, 'admin_suppliers_list' ),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'permission_callback' => function () {
						return Bebba_HF_Auth::require_role( array( 'admin' ) );
					},
					'callback'            => array( __CLASS__, 'admin_suppliers_create' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/suppliers/(?P<id>[^/]+)',
			array(
				array(
					'methods'             => 'PUT',
					'permission_callback' => function () {
						return Bebba_HF_Auth::require_role( array( 'admin' ) );
					},
					'callback'            => array( __CLASS__, 'admin_suppliers_update' ),
				),
				array(
					'methods'             => WP_REST_Server::DELETABLE,
					'permission_callback' => function () {
						return Bebba_HF_Auth::require_role( array( 'admin' ) );
					},
					'callback'            => array( __CLASS__, 'admin_suppliers_delete' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/users',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'permission_callback' => function () {
						return Bebba_HF_Auth::require_role( array( 'admin' ) );
					},
					'callback'            => array( __CLASS__, 'admin_users_list' ),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'permission_callback' => function () {
						return Bebba_HF_Auth::require_role( array( 'admin' ) );
					},
					'callback'            => array( __CLASS__, 'admin_users_create' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/stats',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => function () {
					return Bebba_HF_Auth::require_role( array( 'admin', 'admin_readonly' ) );
				},
				'callback'            => array( __CLASS__, 'admin_stats' ),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/reset-demo-data',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'permission_callback' => function () {
					return Bebba_HF_Auth::require_role( array( 'admin' ) );
				},
				'callback'            => array( __CLASS__, 'admin_reset_demo_data' ),
			)
		);
	register_rest_route(
			self::NAMESPACE_V1,
			'/orders/track-lookup',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'permission_callback' => '__return_true', // Public, protege par rate limit 5 echecs / 10 min.
				'callback'            => array( __CLASS__, 'track_lookup' ),
			)
		);

				/* ------------------------------------------------ phase 3 : commandes (LOT 3) */
				register_rest_route(
						self::NAMESPACE_V1,
						'/orders',
						array(
								'methods'             => WP_REST_Server::CREATABLE,
								'permission_callback' => '__return_true', // Public (invité) OU client authentifié (optionnel).
								'callback'            => array( __CLASS__, 'orders_create' ),
						)
				);

				register_rest_route(
						self::NAMESPACE_V1,
						'/orders/(?P<id>[A-Za-z0-9_-]+)',
						array(
								'methods'             => WP_REST_Server::READABLE,
								'permission_callback' => function () {
										return Bebba_HF_Auth::require_role( Bebba_HF_Auth::ROLES );
								},
								'callback'            => array( __CLASS__, 'orders_get' ),
						)
				);

				register_rest_route(
						self::NAMESPACE_V1,
						'/client/orders',
						array(
								'methods'             => WP_REST_Server::READABLE,
								'permission_callback' => function () {
										return Bebba_HF_Auth::require_role( array( 'client' ) );
								},
								'callback'            => array( __CLASS__, 'client_orders' ),
						)
				);

				/* ------------------------------------------------ phase 5 : flux cuisine & livreur (LOT 5) */
				register_rest_route(
						self::NAMESPACE_V1,
						'/orders',
						array(
								'methods'             => WP_REST_Server::READABLE,
								'permission_callback' => function () {
										return Bebba_HF_Auth::require_role( array( 'admin', 'kitchen', 'driver' ) );
								},
								'callback'            => array( __CLASS__, 'orders_list' ),
						)
				);

				register_rest_route(
						self::NAMESPACE_V1,
						'/orders/(?P<id>[A-Za-z0-9_-]+)/status',
						array(
								'methods'             => WP_REST_Server::EDITABLE,
								'permission_callback' => function () {
										return Bebba_HF_Auth::require_role( array( 'admin', 'kitchen', 'driver' ) );
								},
								'callback'            => array( __CLASS__, 'orders_update_status' ),
								// 'status' reste OPTIONNEL ici : le message exact
								// « Le champ statut est requis. » est produit par le handler
								// (fidélité server.ts l.1109-1112, pas rest_missing_callback_param).
								'args'                => array(
										'status'           => array( 'type' => 'string' ),
										'note'             => array( 'type' => 'string' ),
										'assignedDriverId' => array( 'type' => 'string' ),
								),
						)
				);

				register_rest_route(
						self::NAMESPACE_V1,
						'/orders/(?P<id>[A-Za-z0-9_-]+)/assign-driver',
						array(
								'methods'             => WP_REST_Server::EDITABLE,
								'permission_callback' => function () {
										return Bebba_HF_Auth::require_role( array( 'admin' ) );
								},
								'callback'            => array( __CLASS__, 'orders_assign_driver' ),
								// driverId/assignedDriverId optionnels : le handler produit le
								// message exact « L'identifiant du livreur (driverId) est requis. »
								'args'                => array(
										'driverId'         => array( 'type' => 'string' ),
										'assignedDriverId' => array( 'type' => 'string' ),
								),
						)
				);

				register_rest_route(
						self::NAMESPACE_V1,
						'/orders/(?P<id>[A-Za-z0-9_-]+)/payment',
						array(
								'methods'             => WP_REST_Server::EDITABLE,
								// Comme Express (authenticateUser seul, l.1191) : la cascade 403
								// client/cuisine/lecture-seule est portée PAR LE HANDLER, donc
								// admin_readonly doit atteindre le handler.
								'permission_callback' => function () {
										return Bebba_HF_Auth::require_role( Bebba_HF_Auth::ROLES );
								},
								'callback'            => array( __CLASS__, 'orders_update_payment' ),
								'args'                => array(
										'paymentStatus' => array( 'type' => 'string' ),
								),
						)
				);

		/* ================================================================
		 * CARTE DES ROUTES RESTANTES (spec section 5) — a declarer ici :
		 *
		 * PHASE 2 (catalogue public) : IMPLEMENTEE EN LOT 2 ✓
		 *
		 * PHASE 3 (commandes) : IMPLEMENTÉE EN LOT 3 ✓
		 *   POST /orders              public|client (transaction stock + idempotence)
		 *   GET  /orders/(?P<id>\d+)  admin|kitchen|driver|client (anti-IDOR)
		 *   GET  /client/orders       client
		 *
		 * PHASE 4 (back-office) : IMPLEMENTÉE EN LOT 4 ✓
		 *   POST/PUT/DELETE /categories|products|supplements[/:id]  admin
		 *   GET/POST/PUT /ingredients  admin|kitchen ; DELETE /ingredients/:id  admin
		 *   POST /ingredients/:id/stock  admin|kitchen
		 *   GET  /stock-movements      admin|admin_readonly
		 *   CRUD /suppliers            admin
		 *   GET  /drivers              admin|kitchen ; POST /drivers  admin
		 *   PUT /drivers/:id ; PATCH /drivers/:id/status ; PATCH /drivers/:id/password ; DELETE /drivers/:id  admin
		 *   GET/POST /users            admin (POST refuse role=client)
		 *   GET  /stats                admin|admin_readonly
		 *   POST /admin/reset-demo     admin (reglage ON/OFF, OFF en prod)
		 *
		 * PHASE 5 (cuisine + livreur) : IMPLEMENTÉE EN LOT 5 ✓
		 *   PATCH /orders/:id/status        admin|kitchen|driver (matrice spec 6.1)
		 *   PATCH /orders/:id/assign-driver admin
		 *   PATCH /orders/:id/payment       admin|driver
		 * ================================================================ */
	}

	/* ---------------------------------------------------------------- handlers */

	public static function health(): WP_REST_Response {
		global $wpdb;
		$db_ok = (int) $wpdb->get_var( 'SELECT 1' ) === 1;
		return new WP_REST_Response(
			array(
				'ok'                   => true,
				'version'              => BEBBA_HF_VERSION,
				'db'                   => $db_ok,
				'authorization_header' => '' !== ( isset( $_SERVER['HTTP_AUTHORIZATION'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_AUTHORIZATION'] ) ) : '' ),
			),
			200
		);
	}

	/** Compatibilite : le frontend actuel envoie {username, phone, password}. */
	public static function login( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$mode       = (string) $request->get_param( 'mode' );
		$identifier = (string) ( $request->get_param( 'identifier' ) ?? '' );
		$password   = (string) ( $request->get_param( 'password' ) ?? '' );

		// Format historique du frontend : {username?, phone?, password}.
		if ( '' === $identifier ) {
			$username = trim( (string) $request->get_param( 'username' ) );
			$phone    = trim( (string) $request->get_param( 'phone' ) );
			if ( '' !== $phone && ! $username ) {
				$mode       = 'client';
				$identifier = $phone;
			} elseif ( '' !== $username ) {
				$mode       = 'staff';
				$identifier = $username;
			}
		}

		$result = Bebba_HF_Auth::login( $identifier, $password, $mode );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return new WP_REST_Response( $result, 200 );
	}

	public static function register_client( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		global $wpdb;

		$name     = sanitize_text_field( (string) $request->get_param( 'name' ) );
		$phone    = Bebba_HF_Auth::normalize_phone( (string) $request->get_param( 'phone' ) );
		$password = (string) $request->get_param( 'password' );
		$address  = sanitize_text_field( (string) ( $request->get_param( 'address' ) ?? '' ) );

		if ( '' === $name ) {
			return new WP_Error( 'bebba_bad_request', 'Le nom est obligatoire.', array( 'status' => 400 ) );
		}
		if ( null === $phone ) {
			return new WP_Error( 'bebba_bad_request', 'Numéro de téléphone invalide (au moins 8 chiffres requis).', array( 'status' => 400 ) );
		}
		if ( strlen( $password ) < 6 ) {
			return new WP_Error( 'bebba_bad_request', 'Le mot de passe doit contenir au moins 6 caracteres.', array( 'status' => 400 ) );
		}

		// Throttle inscription (regle 3.4 de la spec).
		$rl_key = 'bebba_rlreg_' . md5( ( isset( $_SERVER['REMOTE_ADDR'] ) ? $_SERVER['REMOTE_ADDR'] : 'cli' ) );
		$hits   = (int) get_transient( $rl_key );
		if ( $hits >= 10 ) {
			return new WP_Error( 'bebba_rate_limited', 'Trop de tentatives. Reessayez plus tard.', array( 'status' => 429 ) );
		}
		set_transient( $rl_key, $hits + 1, 15 * MINUTE_IN_SECONDS );

		$table = Bebba_HF_DB::users_table();

		$exists = $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE phone = %s AND role = 'client' LIMIT 1", $phone )
		);
		if ( (int) $exists > 0 ) {
			return new WP_Error( 'bebba_phone_taken', 'Un compte client avec ce numéro de téléphone existe déjà.', array( 'status' => 400 ) );
		}

		$ok = $wpdb->insert(
			$table,
			array(
				'name'          => $name,
				'phone'         => $phone,
				'address'       => $address,
				'password_hash' => Bebba_HF_Auth::hash_password( $password ),
				'role'          => 'client',
				'active'        => 1,
				'created_at'    => Bebba_HF_DB::now(),
				'updated_at'    => Bebba_HF_DB::now(),
			),
			array( '%s', '%s', '%s', '%s', '%s', '%d', '%s', '%s' )
		);
		if ( false === $ok ) {
			return new WP_Error( 'bebba_server_error', 'Erreur interne.', array( 'status' => 500 ) );
		}

		$user = Bebba_HF_Auth::find_user_by_id( (int) $wpdb->insert_id );
		if ( ! $user ) {
			return new WP_Error( 'bebba_server_error', 'Erreur interne.', array( 'status' => 500 ) );
		}

		return new WP_REST_Response(
			array(
				'token' => Bebba_HF_Auth::issue_token( $user ),
				'user'  => Bebba_HF_Auth::safe_user( $user ),
			),
			201
		);
	}

	public static function me( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$user = Bebba_HF_Auth::require_role( Bebba_HF_Auth::ROLES );
		if ( is_wp_error( $user ) ) {
			return $user;
		}
		return new WP_REST_Response( $user, 200 );
	}

	/** La deconnexion est cote client (suppression du token) ; reponse conservee pour compatibilite. */
	public static function logout(): WP_REST_Response {
		return new WP_REST_Response( array( 'message' => 'Déconnecté.' ), 200 );
	}

	public static function change_password( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$current_password = (string) $request->get_param( 'currentPassword' );
		$new_password     = (string) $request->get_param( 'newPassword' );

		if ( ! $current_password || ! $new_password ) {
			return new WP_Error( 'bebba_bad_request', 'currentPassword et newPassword sont requis.', array( 'status' => 400 ) );
		}

		$result = Bebba_HF_Auth::change_password( $current_password, $new_password );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return new WP_REST_Response( $result, 200 );
	}

	/* ------------------------------------------------------ phase 2 handlers (LOT 2) */

	/** Flag de requete style Express : ?activeOnly=true ou ?active=true. */
	private static function flag_param( WP_REST_Request $request, array $names ): bool {
		foreach ( $names as $name ) {
			$value = $request->get_param( $name );
			if ( null === $value ) {
				continue;
			}
			if ( filter_var( $value, FILTER_VALIDATE_BOOLEAN ) ) {
				return true;
			}
		}
		return false;
	}

	public static function categories_list( WP_REST_Request $request ): WP_REST_Response {
		$active = self::flag_param( $request, array( 'activeOnly', 'active' ) );
		return new WP_REST_Response( Bebba_HF_Catalog::list_categories( $active ), 200 );
	}

	public static function categories_get( WP_REST_Request $request ): WP_REST_Response {
		$cat = Bebba_HF_Catalog::get_category( (string) $request['id'] );
		if ( null === $cat ) {
			return Bebba_HF_Catalog::err( 'Catégorie non trouvée.', 404 );
		}
		return new WP_REST_Response( $cat, 200 );
	}

	public static function products_list( WP_REST_Request $request ): WP_REST_Response {
		$category  = trim( (string) $request->get_param( 'categoryId' ) );
		$active    = self::flag_param( $request, array( 'activeOnly', 'active' ) );
		$available = self::flag_param( $request, array( 'availableOnly', 'available' ) );
		$list      = Bebba_HF_Catalog::list_products( '' !== $category ? $category : null, $active, $available );
		return new WP_REST_Response( $list, 200 );
	}

	public static function products_get( WP_REST_Request $request ): WP_REST_Response {
		$prod = Bebba_HF_Catalog::get_product( (string) $request['id'] );
		if ( null === $prod ) {
			return Bebba_HF_Catalog::err( 'Produit non trouvé.', 404 );
		}
		return new WP_REST_Response( $prod, 200 );
	}

	public static function supplements_list( WP_REST_Request $request ): WP_REST_Response {
		$active    = self::flag_param( $request, array( 'activeOnly', 'active' ) );
		$available = self::flag_param( $request, array( 'availableOnly', 'available' ) );
		return new WP_REST_Response( Bebba_HF_Catalog::list_supplements( $active, $available ), 200 );
	}

	public static function supplements_get( WP_REST_Request $request ): WP_REST_Response {
		$sup = Bebba_HF_Catalog::get_supplement( (string) $request['id'] );
		if ( null === $sup ) {
			return Bebba_HF_Catalog::err( 'Supplément non trouvé.', 404 );
		}
		return new WP_REST_Response( $sup, 200 );
	}

	public static function track_by_token( WP_REST_Request $request ): WP_REST_Response {
		return self::track_response( trim( (string) $request['token'] ) );
	}

	public static function track_by_query( WP_REST_Request $request ): WP_REST_Response {
		return self::track_response( trim( (string) $request->get_param( 'token' ) ) );
	}

	private static function track_response( string $token ): WP_REST_Response {
		if ( '' === $token || strlen( $token ) < 5 ) {
			return Bebba_HF_Catalog::err( 'Lien de suivi invalide ou commande introuvable.', 404 );
		}
		$order = Bebba_HF_Catalog::find_order_by_token( $token );
		if ( null === $order ) {
			return Bebba_HF_Catalog::err( 'Lien de suivi invalide ou commande introuvable.', 404 );
		}
		return new WP_REST_Response( $order, 200 );
	}

	private const LOOKUP_MAX_FAILED = 5;          // echecs avant blocage
	private const LOOKUP_WINDOW     = 600;        // 10 minutes


	/* -------------------------------------------------- handlers admin (LOT 4) */

	/** Corps JSON en tableau (les handlers admin lisent tout le corps). */
	private static function admin_body( WP_REST_Request $request ): array {
		$body = $request->get_json_params();
		return is_array( $body ) ? $body : array();
	}

	/** Gate interne : si le role ne passe pas, propage le WP_Error (401/403). */
	private static function admin_guard( $user ) {
		return is_wp_error( $user ) ? $user : null;
	}

	/** Erreur metier au format Express : {"error": "..."}. */
	private static function admin_catch( Exception $e, int $status = 400 ): WP_REST_Response {
		return Bebba_HF_Catalog::err( $e->getMessage(), $status );
	}

	public static function admin_categories_create( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::save_category( self::admin_body( $request ) ), 201 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e );
		}
	}

	public static function admin_categories_update( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::save_category( self::admin_body( $request ), (string) $request['id'] ), 200 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e );
		}
	}

	public static function admin_categories_delete( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::delete_category( (string) $request['id'] ), 200 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e );
		}
	}

	public static function admin_products_create( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::save_product( self::admin_body( $request ) ), 201 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e );
		}
	}

	public static function admin_products_update( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::save_product( self::admin_body( $request ), (string) $request['id'] ), 200 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e );
		}
	}

	public static function admin_products_delete( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::delete_product( (string) $request['id'] ), 200 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e );
		}
	}

	public static function admin_supplements_create( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::save_supplement( self::admin_body( $request ) ), 201 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e );
		}
	}

	public static function admin_supplements_update( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::save_supplement( self::admin_body( $request ), (string) $request['id'] ), 200 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e );
		}
	}

	public static function admin_supplements_delete( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::delete_supplement( (string) $request['id'] ), 200 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e );
		}
	}

	public static function admin_ingredients_list( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin', 'kitchen' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::list_ingredients(), 200 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e, 500 );
		}
	}

	public static function admin_ingredients_create( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin', 'kitchen' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::save_ingredient( self::admin_body( $request ) ), 201 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e );
		}
	}

	public static function admin_ingredients_update( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin', 'kitchen' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::save_ingredient( self::admin_body( $request ), (string) $request['id'] ), 200 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e );
		}
	}

	public static function admin_ingredients_delete( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::delete_ingredient( (string) $request['id'] ), 200 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e );
		}
	}

	public static function admin_ingredients_stock( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin', 'kitchen' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::adjust_stock( (string) $request['id'], self::admin_body( $request ), $user ), 200 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e );
		}
	}

	public static function admin_stock_movements_list( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin', 'admin_readonly' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::list_stock_movements(), 200 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e, 500 );
		}
	}

	public static function admin_drivers_list( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin', 'kitchen' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::list_drivers(), 200 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e, 500 );
		}
	}

	public static function admin_drivers_create( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::create_driver( self::admin_body( $request ) ), 201 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e );
		}
	}

	public static function admin_drivers_update( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::update_driver( (string) $request['id'], self::admin_body( $request ) ), 200 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e );
		}
	}

	public static function admin_drivers_status( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::set_driver_status( (string) $request['id'], self::admin_body( $request ) ), 200 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e );
		}
	}

	public static function admin_drivers_password( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::reset_driver_password( (string) $request['id'], self::admin_body( $request ) ), 200 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e );
		}
	}

	public static function admin_drivers_delete( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::delete_driver( (string) $request['id'] ), 200 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e );
		}
	}

	public static function admin_suppliers_list( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::list_suppliers(), 200 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e, 500 );
		}
	}

	public static function admin_suppliers_create( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::save_supplier( self::admin_body( $request ) ), 200 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e );
		}
	}

	public static function admin_suppliers_update( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::save_supplier( self::admin_body( $request ), (string) $request['id'] ), 200 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e );
		}
	}

	public static function admin_suppliers_delete( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::delete_supplier( (string) $request['id'] ), 200 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e );
		}
	}

	public static function admin_users_list( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::list_users(), 200 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e, 500 );
		}
	}

	public static function admin_users_create( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::create_user( self::admin_body( $request ) ), 201 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e );
		}
	}

	public static function admin_stats( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin', 'admin_readonly' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::dashboard_stats(), 200 );
		} catch ( Exception $e ) {
			return self::admin_catch( $e, 500 );
		}
	}

	public static function admin_reset_demo_data( WP_REST_Request $request ) {
		$user = Bebba_HF_Auth::require_role( array( 'admin' ) );
		if ( self::admin_guard( $user ) ) {
			return $user;
		}
		try {
			return new WP_REST_Response( Bebba_HF_Admin::reset_demo_data(), 200 );
		} catch ( Exception $e ) {
			return new WP_REST_Response( array( 'error' => '' !== $e->getMessage() ? $e->getMessage() : 'Erreur interne lors de la réinitialisation des données.' ), 500 );
		}
	}
	public static function track_lookup( WP_REST_Request $request ): WP_REST_Response {
		$order_number = (string) $request->get_param( 'orderNumber' );
		$phone        = (string) $request->get_param( 'phone' );
		$bad          = 'Impossible de retrouver cette commande. Vérifiez votre numéro de commande et votre numéro de téléphone.';

		if ( '' === $order_number || '' === $phone ) {
			return Bebba_HF_Catalog::err( $bad, 400 );
		}

		// Rate limit anti-enumeration : 5 echecs par IP, fenetre glissante 10 min, blocage 10 min.
		$ip   = isset( $_SERVER['REMOTE_ADDR'] ) ? (string) $_SERVER['REMOTE_ADDR'] : 'cli';
		$key  = 'bebba_track_' . md5( $ip );
		$now  = time();
		$entry = get_transient( $key );
		if ( ! is_array( $entry ) ) {
			$entry = array( 'failed_attempts' => 0, 'first_attempt_at' => $now );
		}

		if ( ! empty( $entry['blocked_until'] ) && $now < (int) $entry['blocked_until'] ) {
			$minutes = max( 1, (int) ceil( ( (int) $entry['blocked_until'] - $now ) / 60 ) );
			return Bebba_HF_Catalog::err(
				"Trop de tentatives de recherche infructueuses. Par mesure de sécurité, veuillez patienter {$minutes} minute(s) avant de réessayer.",
				429
			);
		}

		$order = Bebba_HF_Catalog::find_order_by_number_and_phone( $order_number, $phone );
		if ( null === $order ) {
			if ( $now - (int) $entry['first_attempt_at'] >= self::LOOKUP_WINDOW ) {
				$entry = array( 'failed_attempts' => 0, 'first_attempt_at' => $now );
			}
			$entry['failed_attempts'] = (int) $entry['failed_attempts'] + 1;
			if ( $entry['failed_attempts'] >= self::LOOKUP_MAX_FAILED ) {
				$entry['blocked_until'] = $now + self::LOOKUP_WINDOW;
			}
			set_transient( $key, $entry, self::LOOKUP_WINDOW );
			return Bebba_HF_Catalog::err( $bad, 404 );
		}

		delete_transient( $key );
		return new WP_REST_Response( $order, 200 );
	}


		/* ------------------------------------------------------ phase 3 handlers (LOT 3) */

		/** Conversion WP_Error -> réponse {"error": ...} (forme Express, cohérente avec le LOT 2). */
		private static function order_error( $wp_error ): WP_REST_Response {
				$data = is_wp_error( $wp_error ) ? $wp_error->get_error_data() : array();
				$data = is_array( $data ) ? $data : array();
				$body = array( 'error' => is_wp_error( $wp_error ) ? $wp_error->get_error_message() : 'Erreur interne.' );
				if ( ! empty( $data['details'] ) ) {
						$body['details'] = $data['details'];
				}
				return new WP_REST_Response( $body, (int) ( $data['status'] ?? 500 ) );
		}

		/**
		* POST /orders — création (invité OU client authentifié).
		* Le champ clientId du body est TOTALEMENT ignoré (anti-spoofing, comme l'original) :
		* seul un jeton Bearer valide peut rattacher la commande à un compte client.
		*/
		public static function orders_create( WP_REST_Request $request ) {
				$payload = array(
						'client' => is_array( $request->get_param( 'client' ) ) ? $request->get_param( 'client' ) : array(),
						'items'  => is_array( $request->get_param( 'items' ) ) ? $request->get_param( 'items' ) : array(),
				);

				$client_id = null;
				$token     = Bebba_HF_Auth::get_bearer_token();
				if ( $token ) {
						$token_payload = Bebba_HF_Auth::verify_token( $token );
						if ( $token_payload && ! empty( $token_payload['sub'] ) ) {
								$user = Bebba_HF_Auth::find_user_by_id( (int) $token_payload['sub'] );
								if ( $user && (int) $user['active'] === 1 && 'client' === $user['role'] ) {
										$client_id = (int) $user['id'];
								}
						}
				}

				$phone_norm = Bebba_HF_Orders::phone8( (string) ( $payload['client']['phone'] ?? '' ) );
				$caller_id  = null !== $client_id ? 'client:' . $client_id : 'guest:' . ( $phone_norm ?: 'unknown' );
				$idem       = trim( (string) $request->get_header( 'idempotency-key' ) );

				$result = Bebba_HF_Orders::create(
						$payload,
						array(
								'caller_id'       => $caller_id,
								'idempotency_key' => '' !== $idem ? $idem : null,
								'client_id'       => $client_id,
						)
				);
				if ( is_wp_error( $result ) ) {
						return self::order_error( $result );
				}
				return new WP_REST_Response( $result['order'], $result['isExisting'] ? 200 : 201 );
		}

		/** GET /orders/{id} — admin/kitchen/driver/client avec protections IDOR d'origine. */
		public static function orders_get( WP_REST_Request $request ) {
				$user = Bebba_HF_Auth::require_role( Bebba_HF_Auth::ROLES );
				if ( is_wp_error( $user ) ) {
						return $user;
				}
				$order = Bebba_HF_Orders::get_for_user( (string) $request['id'], $user );
				if ( is_wp_error( $order ) ) {
						return self::order_error( $order );
				}
				return new WP_REST_Response( $order, 200 );
		}

		/** GET /client/orders — historique du client connecté (le plus récent d'abord). */
		public static function client_orders( WP_REST_Request $request ) {
				$user = Bebba_HF_Auth::require_role( array( 'client' ) );
				if ( is_wp_error( $user ) ) {
						return $user;
				}
				return new WP_REST_Response( Bebba_HF_Orders::list_for_client( (int) $user['id'] ), 200 );
		}

		/**
		* GET /orders — liste staff avec scoping par rôle (server.ts l.674) :
		* admin = tout, cuisine = hors annulées, livreur = ses courses seulement.
		*/
		public static function orders_list( WP_REST_Request $request ) {
				$user = Bebba_HF_Auth::require_role( array( 'admin', 'kitchen', 'driver' ) );
				if ( is_wp_error( $user ) ) {
						return $user;
				}
				return new WP_REST_Response( Bebba_HF_Orders::list_for_staff( $user ), 200 );
		}

		/**
		* PATCH /orders/:id/status — matrice stricte (spec 6.1), IDOR livreur,
		* idempotence même statut, double transition ready→waiting_for_driver,
		* restauration du stock à l'annulation (spec 6.3 — constat C2).
		*/
		public static function orders_update_status( WP_REST_Request $request ) {
				$user = Bebba_HF_Auth::require_role( array( 'admin', 'kitchen', 'driver' ) );
				if ( is_wp_error( $user ) ) {
						return $user;
				}
				$result = Bebba_HF_Orders::update_status( (string) $request['id'], $user, array(
						'status'           => $request->get_param( 'status' ),
						'note'             => $request->get_param( 'note' ),
						'assignedDriverId' => $request->get_param( 'assignedDriverId' ),
				) );
				if ( is_wp_error( $result ) ) {
						return self::order_error( $result );
				}
				return new WP_REST_Response( $result, 200 );
		}

		/**
		* PATCH /orders/:id/assign-driver — admin seul (server.ts l.1174).
		* Toutes les erreurs métier sortent en 400 (catch Express l.1186).
		*/
		public static function orders_assign_driver( WP_REST_Request $request ) {
				$user = Bebba_HF_Auth::require_role( array( 'admin' ) );
				if ( is_wp_error( $user ) ) {
						return $user;
				}
				$result = Bebba_HF_Orders::assign_driver( (string) $request['id'], array(
						'driverId'         => $request->get_param( 'driverId' ),
						'assignedDriverId' => $request->get_param( 'assignedDriverId' ),
				), $user );
				if ( is_wp_error( $result ) ) {
						return self::order_error( $result );
				}
				return new WP_REST_Response( $result, 200 );
		}

		/**
		* PATCH /orders/:id/payment — encaissement (server.ts l.1191-1252) :
		* cascade 403 explicite client/cuisine/lecture-seule portée par le
		* handler, livreur restreint à 'paid' sur ses propres courses.
		*/
		public static function orders_update_payment( WP_REST_Request $request ) {
				$user = Bebba_HF_Auth::require_role( Bebba_HF_Auth::ROLES );
				if ( is_wp_error( $user ) ) {
						return $user;
				}
				$result = Bebba_HF_Orders::update_payment( (string) $request['id'], $user, array(
						'paymentStatus' => $request->get_param( 'paymentStatus' ),
				) );
				if ( is_wp_error( $result ) ) {
						return self::order_error( $result );
				}
				return new WP_REST_Response( $result, 200 );
		}
}
