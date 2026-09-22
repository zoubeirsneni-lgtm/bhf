<?php
/**
 * BEBBA — Harnais de test automatique du LOT 5 (plugin v0.5.0)
 *
 * À COPIER dans la racine WordPress (C:\wamp64\www\bebbabhf\) puis ouvrir :
 *   http://localhost/bebbabhf/bebba-test-lot5.php
 *
 * ⚠️ FICHIER TEMPORAIRE DE TEST : à SUPPRIMER après usage.
 * ⚠️ Crée des comptes de test (admin/kitchen/readonly/3 livreurs/1 client) et
 *    4 commandes, puis FINIT PAR POST /reset-demo-data : TOUTES les commandes
 *    existantes sont supprimées, stocks seed et compteur (1100) restaurés,
 *    clients et livreurs purgés. Catalogue et comptes staff préservés ; les 3
 *    comptes staff de test sont supprimés par le harnais à la fin.
 *
 * Couvre (spec §6.1 + §6.3 — critères d'acceptation Phase 5) :
 *  - GET /orders avec scoping par rôle (admin tout, cuisine hors annulées,
 *    livreur ses courses seulement) ;
 *  - PATCH /orders/:id/status : matrice stricte (aucun saut, aucun retour
 *    arrière, client/readonly jamais), idempotence même statut, IDOR livreur
 *    (2 livreurs), double transition automatique ready→waiting_for_driver,
 *    validations livreur au passage à 'delivering' (absent/inconnu/désactivé),
 *    compteur totalDeliveries, statuts terminaux ;
 *  - PATCH /orders/:id/assign-driver (admin seul, commande clôturée refusée) ;
 *  - PATCH /orders/:id/payment : cascade 403 client/cuisine/readonly,
 *    encaissement 'paid' réservé aux commandes livrées, livreur limité à
 *    'paid' sur SES courses ;
 *  - Restauration du stock à l'annulation (amélioration spec §6.3, constat C2)
 *    avec mouvements order_cancellation_restore et idempotence du re-cancel ;
 *  - reset-demo-data + isolation wp_users.
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

/** Appel HTTP REST local. Retour : [code, body_decode]. */
function bebba_http( string $method, string $path, ?array $payload = null, array $headers = array() ): array {
        $base = untrailingslashit( get_option( 'siteurl' ) );
        $args = array(
                'method'  => $method,
                'timeout' => 30,
                'headers' => $headers,
        );
        if ( null !== $payload ) {
                $args['headers']['Content-Type'] = 'application/json';
                $args['body']                    = wp_json_encode( $payload, JSON_UNESCAPED_UNICODE );
        }
        $res  = wp_remote_request( $base . '/wp-json/bebba/v1' . $path, $args );
        $code = is_wp_error( $res ) ? 0 : (int) wp_remote_retrieve_response_code( $res );
        $body = is_wp_error( $res ) ? null : json_decode( wp_remote_retrieve_body( $res ), true );
        return array( $code, $body );
}

function bebba_bearer( string $token ): array {
        return array( 'Authorization' => 'Bearer ' . $token );
}

/** Carte legacy_id -> stock de TOUS les ingrédients. */
function bebba_all_stocks(): array {
        global $wpdb;
        $rows = $wpdb->get_results( 'SELECT legacy_id, stock_quantity FROM ' . Bebba_HF_DB::ingredients_table(), ARRAY_A );
        $out  = array();
        foreach ( ( $rows ?: array() ) as $r ) {
                $out[ (string) $r['legacy_id'] ] = (float) $r['stock_quantity'];
        }
        ksort( $out );
        return $out;
}

function bebba_stocks_delta( array $before, array $after ): array {
        $d = array();
        foreach ( $before as $k => $v ) {
                if ( abs( ( $after[ $k ] ?? $v ) - $v ) > 0.001 ) {
                        $d[ $k ] = round( ( $after[ $k ] ?? 0 ) - $v, 2 );
                }
        }
        return $d;
}

function bebba_restore_moves( int $order_id ): int {
        global $wpdb;
        return (int) $wpdb->get_var( $wpdb->prepare(
                "SELECT COUNT(*) FROM " . Bebba_HF_DB::stock_movements_table() . " WHERE order_id = %d AND movement_type = 'order_cancellation_restore'",
                $order_id
        ) );
}

/** Crée une commande invitée standard et retourne [code, body]. */
function bebba_guest_order( string $phone ): array {
        $payload = array(
                'client' => array(
                        'name'            => 'Client Invité LOT5',
                        'phone'           => $phone,
                        'deliveryAddress' => '12 rue du Test, Tunis',
                        'notes'           => 'Sans oignons',
                ),
                'items'  => array( array(
                        'productId'           => 'prod-chicken-bowl',
                        'quantity'            => 1,
                        'proteinOption'       => array( 'label' => 'Portion sportive (+100g)' ),
                        'veggiesOption'       => array( 'label' => 'Double légumes (+50g)' ),
                        'baseChoice'          => array( 'label' => 'Base quinoa' ),
                        'supplements'         => array( array( 'id' => 'sup-poulet-extra', 'quantity' => 1 ) ),
                        'specialInstructions' => 'Bien croustillant',
                ) ),
        );
        return bebba_http( 'POST', '/orders', $payload );
}

/** id numérique interne d'une commande depuis son token de tracking. */
function bebba_order_row_id( array $order_body ): int {
        global $wpdb;
        $token = (string) ( $order_body['trackingToken'] ?? '' );
        if ( '' !== $token ) {
                $id = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT id FROM ' . Bebba_HF_DB::orders_table() . ' WHERE tracking_token = %s', $token ) );
                if ( $id > 0 ) {
                        return $id;
                }
        }
        return (int) $wpdb->get_var( 'SELECT MAX(id) FROM ' . Bebba_HF_DB::orders_table() );
}

global $wpdb;
$wp_users_before = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . $wpdb->users );

/* Pré-nettoyage idempotent (tables du PLUGIN uniquement — jamais wp_users).
 * 1) Les commandes de test d'un passage interrompu sont supprimées D'ABORD :
 *    elles référencent les livreurs de test (FK driver_id) et bloqueraient
 *    leur suppression ; les enfants (lignes/historique) partent en CASCADE.
 * 2) Livreurs de test (téléphones dédiés), 3) comptes staff de test. */
$wpdb->query( "DELETE FROM " . Bebba_HF_DB::orders_table() . " WHERE customer_phone IN ('99200001','99200002','99200003','99200004') OR driver_legacy_id IN (SELECT legacy_id FROM " . Bebba_HF_DB::drivers_table() . " WHERE phone IN ('99000005','99000006','99000007'))" );
$wpdb->query( "DELETE FROM " . Bebba_HF_DB::drivers_table() . " WHERE phone IN ('99000005','99000006','99000007')" );
$wpdb->query( "DELETE FROM " . Bebba_HF_DB::users_table() . " WHERE username IN ('test-admin-lot5','test-kitchen-lot5','test-readonly-lot5','test-driver-lot5','test-driver-lot5b','test-driver-lot5c')" );

echo "=== BEBBA TESTS LOT 5 (plugin " . esc_html( BEBBA_HF_VERSION ) . ") ===\n\n";

/* ---------------------------------------------------------------- T1 health */
list( $code, $body ) = bebba_http( 'GET', '/health' );
bebba_test( 'T1 health version 0.5.0', 200 === $code && '0.5.0' === (string) ( $body['version'] ?? '' ), "code=$code body=" . wp_json_encode( $body ) );

/* --------------------------------------------- T2 compte admin de test (DB) */
$wpdb->insert(
        Bebba_HF_DB::users_table(),
        array(
                'username'      => 'test-admin-lot5',
                'name'          => 'Test Admin LOT5',
                'phone'         => '99000001',
                'password_hash' => Bebba_HF_Auth::hash_password( 'pass-admin-1234' ),
                'role'          => 'admin',
                'active'        => 1,
                'token_version' => 0,
        ),
        array( '%s', '%s', '%s', '%s', '%s', '%d', '%d' )
);
list( $code, $login ) = bebba_http( 'POST', '/auth/login', array(
        'username' => 'test-admin-lot5',
        'password' => 'pass-admin-1234',
) );
$admin_token = (string) ( $login['token'] ?? '' );
bebba_test( 'T2 login admin (compte de test) → 200 + rôle admin', 200 === $code && 'admin' === (string) ( $login['user']['role'] ?? '' ) && '' !== $admin_token, "code=$code body=" . wp_json_encode( $login ) );

/* --------------------------------------------- T3 client de test */
$client_phone = '216' . random_int( 10000000, 99999999 );
list( $code, $reg ) = bebba_http( 'POST', '/auth/register-client', array(
        'name'     => 'Client Test LOT5',
        'phone'    => $client_phone,
        'password' => 'pass-client-1234',
) );
$client_token = (string) ( $reg['token'] ?? '' );
bebba_test( 'T3 inscription client → 201 + token', 201 === $code && '' !== $client_token && 'client' === (string) ( $reg['user']['role'] ?? '' ), "code=$code body=" . wp_json_encode( $reg ) );

/* --------------------------------------- T4/T5 comptes kitchen + readonly */
list( $code_c, $k ) = bebba_http( 'POST', '/users', array(
        'username' => 'test-kitchen-lot5',
        'password' => 'pass-kitchen-1234',
        'name'     => 'Test Kitchen LOT5',
        'role'     => 'kitchen',
), bebba_bearer( $admin_token ) );
list( $code, $kl ) = bebba_http( 'POST', '/auth/login', array(
        'username' => 'test-kitchen-lot5',
        'password' => 'pass-kitchen-1234',
) );
$kitchen_token = (string) ( $kl['token'] ?? '' );
bebba_test( 'T4 compte cuisine → 201 + login 200 + rôle kitchen', 201 === $code_c && 200 === $code && '' !== $kitchen_token && 'kitchen' === (string) ( $kl['user']['role'] ?? '' ), "create=$code_c login=$code body=" . wp_json_encode( $kl ) );

list( $code_c, $ro ) = bebba_http( 'POST', '/users', array(
        'username' => 'test-readonly-lot5',
        'password' => 'pass-readonly-1234',
        'name'     => 'Test Readonly LOT5',
        'role'     => 'admin_readonly',
), bebba_bearer( $admin_token ) );
list( $code, $rol ) = bebba_http( 'POST', '/auth/login', array(
        'username' => 'test-readonly-lot5',
        'password' => 'pass-readonly-1234',
) );
$ro_token = (string) ( $rol['token'] ?? '' );
bebba_test( 'T5 compte lecture-seule → 201 + login 200', 201 === $code_c && 200 === $code && '' !== $ro_token, "create=$code_c login=$code body=" . wp_json_encode( $rol ) );

/* --------------------------------------------- T6/T7/T8 trois livreurs */
function bebba_make_driver( string $suffix, string $phone, string $name, string $token ): array {
        global $wpdb;
        list( $code, $drv ) = bebba_http( 'POST', '/drivers', array(
                'name'     => $name,
                'phone'    => $phone,
                'username' => $suffix,
                'password' => 'pass-driver-1234',
                'vehicle'  => 'Moto test',
        ), bebba_bearer( $token ) );
        $drv_id = (string) ( $drv['driver']['id'] ?? '' );
        list( $code_l, $lg ) = bebba_http( 'POST', '/auth/login', array(
                'username' => $suffix,
                'password' => 'pass-driver-1234',
        ) );
        $row = $wpdb->get_row( $wpdb->prepare( 'SELECT id FROM ' . Bebba_HF_DB::drivers_table() . ' WHERE legacy_id = %s', $drv_id ), ARRAY_A );
        return array(
                'code'     => $code,
                'id'       => $drv_id,
                'num'      => $row ? (int) $row['id'] : 0,
                'token'    => (string) ( $lg['token'] ?? '' ),
                'name'     => $name,
                'login_ok' => 200 === $code_l,
        );
}

$drvA = bebba_make_driver( 'test-driver-lot5', '99000005', 'Livreur Test LOT5 A', $admin_token );
bebba_test( 'T6 livreur A → création 201 + login 200', 201 === $drvA['code'] && '' !== $drvA['id'] && $drvA['login_ok'], "code={$drvA['code']} body=" . wp_json_encode( $drvA ) );
$drvB = bebba_make_driver( 'test-driver-lot5b', '99000006', 'Livreur Test LOT5 B', $admin_token );
bebba_test( 'T7 livreur B → création 201 + login 200', 201 === $drvB['code'] && '' !== $drvB['id'] && $drvB['login_ok'], "code={$drvB['code']}" );
$drvC = bebba_make_driver( 'test-driver-lot5c', '99000007', 'Livreur Test LOT5 C', $admin_token );
bebba_test( 'T8 livreur C → création 201 (sera désactivé au T27)', 201 === $drvC['code'] && '' !== $drvC['id'], "code={$drvC['code']}" );

/* ---------------------------------------- T9 commande invitée O1 (happy path) */
list( $code, $o1 ) = bebba_guest_order( '99200001' );
$oid1   = $o1 ? bebba_order_row_id( $o1 ) : 0;
$o1_ref = (string) ( $o1['id'] ?? '' ); // id business (legacy)
bebba_test( 'T9 commande invitée O1 → 201', 201 === $code && $oid1 > 0, "code=$code body=" . wp_json_encode( $o1 ) );

/* --------------------------------------- T10-T14 GET /orders scoping par rôle */
list( $code, $list ) = bebba_http( 'GET', '/orders', null, bebba_bearer( $admin_token ) );
$found = false;
foreach ( ( $list ?: array() ) as $o ) {
        if ( $o1_ref === (string) ( $o['id'] ?? '' ) ) {
                $found = true;
        }
}
bebba_test( 'T10 GET /orders (admin) → 200, contient O1', 200 === $code && is_array( $list ) && $found, "code=$code n=" . ( is_array( $list ) ? count( $list ) : -1 ) );

list( $code, $list ) = bebba_http( 'GET', '/orders', null, bebba_bearer( $kitchen_token ) );
$found = false;
foreach ( ( $list ?: array() ) as $o ) {
        if ( $o1_ref === (string) ( $o['id'] ?? '' ) ) {
                $found = true;
        }
}
bebba_test( 'T11 GET /orders (cuisine) → 200, contient O1', 200 === $code && $found, "code=$code n=" . ( is_array( $list ) ? count( $list ) : -1 ) );

list( $code, $list ) = bebba_http( 'GET', '/orders', null, bebba_bearer( $drvA['token'] ) );
bebba_test( 'T12 GET /orders (livreur A, course non assignée) → 200, liste vide', 200 === $code && is_array( $list ) && 0 === count( $list ), "code=$code n=" . ( is_array( $list ) ? count( $list ) : -1 ) );

list( $code, $err ) = bebba_http( 'GET', '/orders', null, bebba_bearer( $client_token ) );
bebba_test( 'T13 GET /orders (client) → 403', 403 === $code, "code=$code body=" . wp_json_encode( $err ) );

list( $code, $err ) = bebba_http( 'GET', '/orders', null, bebba_bearer( $ro_token ) );
bebba_test( 'T14 GET /orders (lecture-seule) → 403', 403 === $code, "code=$code body=" . wp_json_encode( $err ) );

/* ------------------------------------- T15-T18 flux cuisine sur O1 */
list( $code, $st ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o1_ref ) . '/status', array( 'status' => 'preparing' ), bebba_bearer( $kitchen_token ) );
$hist = is_array( $st ) ? ( $st['statusHistory'] ?? array() ) : array();
$last = ( $hist ?: array() ) ? end( $hist ) : array();
bebba_test( 'T15 cuisine received→preparing → 200 + updatedBy "(Cuisine)"', 200 === $code && 'preparing' === (string) ( $st['status'] ?? '' )
        && 'En préparation en cuisine' === (string) ( $last['label'] ?? '' )
        && 'Test Kitchen LOT5 (Cuisine)' === (string) ( $last['updatedBy'] ?? '' ), "code=$code body=" . wp_json_encode( $st, JSON_UNESCAPED_UNICODE ) );

list( $code, $err ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o1_ref ) . '/status', array( 'status' => 'delivered' ), bebba_bearer( $kitchen_token ) );
bebba_test( 'T16 cuisine preparing→delivered (saut) → 403 message exact', 403 === $code
        && "Transition interdite : Le rôle 'kitchen' n'est pas autorisé à passer de 'preparing' à 'delivered'." === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

list( $code, $st ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o1_ref ) . '/status', array( 'status' => 'ready' ), bebba_bearer( $kitchen_token ) );
$hist  = is_array( $st ) ? ( $st['statusHistory'] ?? array() ) : array();
$n     = count( $hist );
$prev  = $n >= 2 ? $hist[ $n - 2 ] : array();
$last  = $n >= 1 ? $hist[ $n - 1 ] : array();
$double_ok = 'waiting_for_driver' === (string) ( $st['status'] ?? '' )
        && 'ready' === (string) ( $prev['status'] ?? '' )
        && 'Plats préparés et emballés en sac thermique' === (string) ( $prev['note'] ?? '' )
        && 'Test Kitchen LOT5 (Cuisine)' === (string) ( $prev['updatedBy'] ?? '' )
        && 'waiting_for_driver' === (string) ( $last['status'] ?? '' )
        && "Placée automatiquement en attente d'attribution d'un livreur" === (string) ( $last['note'] ?? '' )
        && 'Système BEBBA' === (string) ( $last['updatedBy'] ?? '' );
bebba_test( 'T17 cuisine preparing→ready → double transition automatique vers waiting_for_driver', 200 === $code && $double_ok, "code=$code body=" . wp_json_encode( $st, JSON_UNESCAPED_UNICODE ) );

list( $code, $cur ) = bebba_http( 'GET', '/orders/' . rawurlencode( $o1_ref ), null, bebba_bearer( $admin_token ) );
$n_before = is_array( $cur ) ? count( $cur['statusHistory'] ?? array() ) : -1;
list( $code, $st ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o1_ref ) . '/status', array( 'status' => 'waiting_for_driver' ), bebba_bearer( $admin_token ) );
list( $code2, $cur2 ) = bebba_http( 'GET', '/orders/' . rawurlencode( $o1_ref ), null, bebba_bearer( $admin_token ) );
$n_after = is_array( $cur2 ) ? count( $cur2['statusHistory'] ?? array() ) : -1;
bebba_test( 'T18 idempotence même statut → 200, aucun effet de bord', 200 === $code && 200 === $code2 && $n_before === $n_after && 'waiting_for_driver' === (string) ( $cur2['status'] ?? '' ), "code=$code/$code2 hist=$n_before->$n_after" );

/* ------------------------------------- T19-T22 assign-driver sur O1 */
list( $code, $err ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o1_ref ) . '/assign-driver', array(), bebba_bearer( $admin_token ) );
bebba_test( 'T19 assign-driver sans driverId → 400 message exact', 400 === $code && 'L’identifiant du livreur (driverId) est requis.' === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

list( $code, $err ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o1_ref ) . '/assign-driver', array( 'driverId' => 'drv-ghost' ), bebba_bearer( $admin_token ) );
bebba_test( 'T20 assign-driver livreur inconnu → 400 "Livreur #drv-ghost introuvable."', 400 === $code && 'Livreur #drv-ghost introuvable.' === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

list( $code, $err ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o1_ref ) . '/assign-driver', array( 'driverId' => $drvA['id'] ), bebba_bearer( $kitchen_token ) );
bebba_test( 'T21 assign-driver par la cuisine → 403', 403 === $code, "code=$code body=" . wp_json_encode( $err ) );

list( $code, $st ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o1_ref ) . '/assign-driver', array( 'driverId' => $drvA['id'] ), bebba_bearer( $admin_token ) );
$hist  = is_array( $st ) ? ( $st['statusHistory'] ?? array() ) : array();
$last  = ( $hist ?: array() ) ? end( $hist ) : array();
bebba_test( 'T22 assign-driver admin livreur A → 200 + trace "Livreur affecté : ..."', 200 === $code
        && $drvA['id'] === (string) ( $st['assignedDriverId'] ?? '' )
        && 'Livreur affecté : Livreur Test LOT5 A' === (string) ( $last['label'] ?? '' )
        && 'Test Admin LOT5 (Admin)' === (string) ( $last['updatedBy'] ?? '' ), "code=$code body=" . wp_json_encode( $st, JSON_UNESCAPED_UNICODE ) );

/* ------------------------------------- T23-T29 validations 'delivering' sur O2 */
list( $code, $o2 ) = bebba_guest_order( '99200002' );
$oid2   = $o2 ? bebba_order_row_id( $o2 ) : 0;
$o2_ref = (string) ( $o2['id'] ?? '' );
bebba_test( 'T23 commande invitée O2 → 201', 201 === $code && $oid2 > 0, "code=$code" );

/* admin enchaîne received→preparing→ready (double auto → waiting_for_driver) */
list( $code1, $x ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o2_ref ) . '/status', array( 'status' => 'preparing' ), bebba_bearer( $admin_token ) );
list( $code2, $x ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o2_ref ) . '/status', array( 'status' => 'ready' ), bebba_bearer( $admin_token ) );
bebba_test( 'T24 admin O2 received→preparing→ready → waiting_for_driver', 200 === $code1 && 200 === $code2 && 'waiting_for_driver' === (string) ( $x['status'] ?? '' ), "codes=$code1/$code2 body=" . wp_json_encode( $x ) );

list( $code, $err ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o2_ref ) . '/status', array( 'status' => 'delivering' ), bebba_bearer( $admin_token ) );
bebba_test( 'T25 delivering sans livreur → 400 message exact', 400 === $code
        && "Une commande ne peut pas passer en cours de livraison sans attribution préalable d'un livreur." === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

list( $code, $err ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o2_ref ) . '/status', array( 'status' => 'delivering', 'assignedDriverId' => 'drv-ghost' ), bebba_bearer( $admin_token ) );
bebba_test( 'T26 delivering livreur inconnu → 400 "Livreur #drv-ghost introuvable."', 400 === $code && 'Livreur #drv-ghost introuvable.' === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

list( $code_d, $stc ) = bebba_http( 'PATCH', '/drivers/' . rawurlencode( $drvC['id'] ) . '/status', array( 'active' => false ), bebba_bearer( $admin_token ) );
list( $code, $err ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o2_ref ) . '/status', array( 'status' => 'delivering', 'assignedDriverId' => $drvC['id'] ), bebba_bearer( $admin_token ) );
bebba_test( 'T27 delivering livreur désactivé → 400 message exact', 200 === $code_d && 400 === $code
        && 'Le livreur "Livreur Test LOT5 C" est désactivé et ne peut pas recevoir de nouvelle commande.' === (string) ( $err['error'] ?? '' ), "deact=$code_d code=$code body=" . wp_json_encode( $err ) );

list( $code, $err ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o2_ref ) . '/status', array( 'status' => 'delivering', 'assignedDriverId' => $drvA['id'] ), bebba_bearer( $kitchen_token ) );
bebba_test( 'T28 cuisine waiting_for_driver→delivering → 403 message exact', 403 === $code
        && "Transition interdite : Le rôle 'kitchen' n'est pas autorisé à passer de 'waiting_for_driver' à 'delivering'." === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

/* T29 : admin livre O1 SANS assignedDriverId -> réutilise le livreur existant (A) */
list( $code, $st ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o1_ref ) . '/status', array( 'status' => 'delivering' ), bebba_bearer( $admin_token ) );
bebba_test( 'T29 admin O1 → delivering sans param → réutilise le livreur A', 200 === $code && 'delivering' === (string) ( $st['status'] ?? '' ) && $drvA['id'] === (string) ( $st['assignedDriverId'] ?? '' ), "code=$code body=" . wp_json_encode( $st ) );

/* ------------------------------------- T30-T34 flux livreur sur O1 */
list( $code, $err ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o1_ref ) . '/status', array( 'status' => 'delivered' ), bebba_bearer( $drvB['token'] ) );
bebba_test( 'T30 IDOR livreur B sur la course de A → 403 message exact', 403 === $code && 'Accès refusé : Cette commande ne vous est pas attribuée.' === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

list( $code, $err ) = bebba_http( 'GET', '/orders/' . rawurlencode( $o1_ref ), null, bebba_bearer( $drvB['token'] ) );
bebba_test( 'T31 IDOR lecture : livreur B voit la course de A → 403', 403 === $code, "code=$code body=" . wp_json_encode( $err ) );

list( $code, $st ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o1_ref ) . '/status', array( 'status' => 'delivered' ), bebba_bearer( $drvA['token'] ) );
$hist = is_array( $st ) ? ( $st['statusHistory'] ?? array() ) : array();
$last = ( $hist ?: array() ) ? end( $hist ) : array();
bebba_test( 'T32 livreur A delivering→delivered → 200 + updatedBy "(Livreur)"', 200 === $code && 'delivered' === (string) ( $st['status'] ?? '' )
        && 'Commande livrée au client' === (string) ( $last['label'] ?? '' )
        && 'Livreur Test LOT5 A (Livreur)' === (string) ( $last['updatedBy'] ?? '' ), "code=$code body=" . wp_json_encode( $st, JSON_UNESCAPED_UNICODE ) );

list( $code, $drvs ) = bebba_http( 'GET', '/drivers', null, bebba_bearer( $admin_token ) );
$td = -1;
foreach ( ( $drvs ?: array() ) as $d ) {
        if ( $drvA['id'] === (string) ( $d['id'] ?? '' ) ) {
                $td = (int) ( $d['totalDeliveries'] ?? -1 );
        }
}
bebba_test( 'T33 totalDeliveries du livreur A incrémenté → 1', 200 === $code && 1 === $td, "code=$code totalDeliveries=$td" );

list( $code, $err ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o1_ref ) . '/status', array( 'status' => 'cancelled' ), bebba_bearer( $admin_token ) );
bebba_test( 'T34 statut terminal : delivered→cancelled → 403 message exact', 403 === $code
        && "Transition interdite : Le rôle 'admin' n'est pas autorisé à passer de 'delivered' à 'cancelled'." === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

/* ------------------------------------- T35-T42 encaissement (payment) */
list( $code, $err ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o1_ref ) . '/payment', array( 'paymentStatus' => 'paid' ), bebba_bearer( $client_token ) );
bebba_test( 'T35 payment par un client → 403 message exact', 403 === $code && 'Accès refusé : Les clients ne sont pas autorisés à modifier le statut de paiement.' === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

list( $code, $err ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o1_ref ) . '/payment', array( 'paymentStatus' => 'paid' ), bebba_bearer( $kitchen_token ) );
bebba_test( 'T36 payment par la cuisine → 403 message exact', 403 === $code && 'Accès refusé : La cuisine n’a pas l’autorisation de modifier le statut de paiement.' === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

list( $code, $err ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o1_ref ) . '/payment', array( 'paymentStatus' => 'paid' ), bebba_bearer( $ro_token ) );
bebba_test( 'T37 payment par la lecture-seule → 403 message exact', 403 === $code && 'Accès refusé : Lecture seule, modification du paiement interdite.' === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

list( $code, $err ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o1_ref ) . '/payment', array( 'paymentStatus' => 'bogus' ), bebba_bearer( $admin_token ) );
bebba_test( 'T38 paymentStatus invalide → 400 "Statut de paiement invalide."', 400 === $code && 'Statut de paiement invalide.' === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

list( $code, $err ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o2_ref ) . '/payment', array( 'paymentStatus' => 'paid' ), bebba_bearer( $admin_token ) );
bebba_test( 'T39 encaisser une commande non livrée → 400 message exact', 400 === $code
        && "Impossible d'encaisser une commande qui n'est pas encore livrée." === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

list( $code, $err ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o1_ref ) . '/payment', array( 'paymentStatus' => 'to_collect' ), bebba_bearer( $drvA['token'] ) );
bebba_test( 'T40 livreur ne peut poser que "paid" → 400 message exact', 400 === $code && 'Le livreur peut uniquement enregistrer le paiement reçu (paid).' === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

list( $code, $err ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o1_ref ) . '/payment', array( 'paymentStatus' => 'paid' ), bebba_bearer( $drvB['token'] ) );
bebba_test( 'T41 IDOR payment : livreur B sur la course de A → 403', 403 === $code && 'Accès refusé : Cette commande ne vous est pas attribuée.' === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

list( $code, $st ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o1_ref ) . '/payment', array( 'paymentStatus' => 'paid' ), bebba_bearer( $admin_token ) );
bebba_test( 'T42 admin encaisse O1 livrée → 200 paymentStatus=paid', 200 === $code && 'paid' === (string) ( $st['paymentStatus'] ?? '' ), "code=$code body=" . wp_json_encode( $st ) );

/* ------------------------------------- T43-T46 annulation + restauration stock (O3) */
$stocks_before = bebba_all_stocks();
list( $code, $o3 ) = bebba_guest_order( '99200003' );
$oid3   = $o3 ? bebba_order_row_id( $o3 ) : 0;
$o3_ref = (string) ( $o3['id'] ?? '' );
$stocks_after_create = bebba_all_stocks();
$d_create = bebba_stocks_delta( $stocks_before, $stocks_after_create );
bebba_test( 'T43 commande invitée O3 → 201 + stock décrémenté à la création', 201 === $code && $oid3 > 0 && count( $d_create ) > 0, "code=$code delta=" . wp_json_encode( $d_create ) );

list( $code, $st ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o3_ref ) . '/status', array( 'status' => 'cancelled' ), bebba_bearer( $admin_token ) );
$stocks_after_cancel = bebba_all_stocks();
$d_cancel = bebba_stocks_delta( $stocks_before, $stocks_after_cancel );
$moves    = bebba_restore_moves( $oid3 );
bebba_test( 'T44 admin received→cancelled → 200, stock RESTAURÉ + mouvements order_cancellation_restore', 200 === $code && 'cancelled' === (string) ( $st['status'] ?? '' )
        && 0 === count( $d_cancel ) && $moves >= 1, "code=$code moves=$moves delta=" . wp_json_encode( $d_cancel ) . ' body=' . wp_json_encode( $st ) );

list( $code, $st ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o3_ref ) . '/status', array( 'status' => 'cancelled' ), bebba_bearer( $admin_token ) );
$stocks_after_recancel = bebba_all_stocks();
$d_re = bebba_stocks_delta( $stocks_before, $stocks_after_recancel );
$moves2 = bebba_restore_moves( $oid3 );
bebba_test( 'T45 re-cancel idempotent → 200, stock intact (pas de double restauration)', 200 === $code && 0 === count( $d_re ) && $moves2 === $moves, "code=$code moves=$moves2 delta=" . wp_json_encode( $d_re ) );

list( $code, $err ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o3_ref ) . '/assign-driver', array( 'driverId' => $drvA['id'] ), bebba_bearer( $admin_token ) );
bebba_test( 'T46 assign-driver sur commande annulée → 400 message exact', 400 === $code
        && 'Impossible de modifier l’affectation d’une commande clôturée ou annulée.' === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

/* ------------------------------------- T47-T48 matrice admin : saut + retour arrière (O4) */
list( $code_o4, $o4 ) = bebba_guest_order( '99200004' );
$o4_ref = (string) ( $o4['id'] ?? '' );
list( $code, $err ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o4_ref ) . '/status', array( 'status' => 'delivered' ), bebba_bearer( $admin_token ) );
bebba_test( 'T47 admin received→delivered (saut) → 403 message exact', 201 === $code_o4 && 403 === $code
        && "Transition interdite : Le rôle 'admin' n'est pas autorisé à passer de 'received' à 'delivered'." === (string) ( $err['error'] ?? '' ), "create=$code_o4 code=$code body=" . wp_json_encode( $err ) );

list( $code_p, $x ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o4_ref ) . '/status', array( 'status' => 'preparing' ), bebba_bearer( $admin_token ) );
list( $code, $err ) = bebba_http( 'PATCH', '/orders/' . rawurlencode( $o4_ref ) . '/status', array( 'status' => 'received' ), bebba_bearer( $admin_token ) );
bebba_test( 'T48 admin preparing→received (retour arrière) → 403 message exact', 200 === $code_p && 403 === $code
        && "Transition interdite : Le rôle 'admin' n'est pas autorisé à passer de 'preparing' à 'received'." === (string) ( $err['error'] ?? '' ), "prep=$code_p code=$code body=" . wp_json_encode( $err ) );

/* ------------------------------------- T49-T50 listes après annulations */
list( $code, $list ) = bebba_http( 'GET', '/orders', null, bebba_bearer( $kitchen_token ) );
$has_o3 = false;
$has_o4 = false;
foreach ( ( $list ?: array() ) as $o ) {
        if ( $o3_ref === (string) ( $o['id'] ?? '' ) ) {
                $has_o3 = true;
        }
        if ( $o4_ref === (string) ( $o['id'] ?? '' ) ) {
                $has_o4 = true;
        }
}
bebba_test( 'T49 GET /orders (cuisine) exclut les annulées, garde les actives', 200 === $code && ! $has_o3 && $has_o4, "code=$code o3=$has_o3 o4=$has_o4" );

list( $code, $list ) = bebba_http( 'GET', '/orders', null, bebba_bearer( $drvA['token'] ) );
$ids = array();
foreach ( ( $list ?: array() ) as $o ) {
        $ids[] = (string) ( $o['id'] ?? '' );
}
bebba_test( 'T50 GET /orders (livreur A) → uniquement SA course O1', 200 === $code && in_array( $o1_ref, $ids, true ) && 1 === count( $ids ), "code=$code ids=" . wp_json_encode( $ids ) );

/* ------------------------------------- T51 reset demo + T52 isolation */
list( $code, $rst ) = bebba_http( 'POST', '/reset-demo-data', null, bebba_bearer( $admin_token ) );
$orders_after = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . Bebba_HF_DB::orders_table() );
$drivers_after = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . Bebba_HF_DB::drivers_table() );
$clients_after = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . Bebba_HF_DB::users_table() . " WHERE role = 'client'" );
bebba_test( 'T51 POST /reset-demo-data → success, compteur 1100, base purgée, stocks seed', 200 === $code
        && true === ( $rst['success'] ?? null )
        && 1100 === (int) $wpdb->get_var( "SELECT current_value FROM " . Bebba_HF_DB::counters_table() . " WHERE counter_name = 'orders'" )
        && 0 === $orders_after && 0 === $drivers_after && 0 === $clients_after, "code=$code body=" . wp_json_encode( $rst ) );

$wp_users_after = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . $wpdb->users );
bebba_test( 'T52 isolation : wp_users inchangé', $wp_users_before === $wp_users_after, "before=$wp_users_before after=$wp_users_after" );

/* ------------------------------------------------- nettoyage des comptes staff */
$wpdb->query( $wpdb->prepare(
        'DELETE FROM ' . Bebba_HF_DB::users_table() . ' WHERE username IN (%s,%s,%s)',
        'test-admin-lot5',
        'test-kitchen-lot5',
        'test-readonly-lot5'
) );
echo "\n[NETTOYAGE] comptes staff de test supprimés (test-admin-lot5, test-kitchen-lot5, test-readonly-lot5)\n";

/* ------------------------------------------------------------------ résultat */
$pass_count = 0;
foreach ( $results as $r ) {
        if ( $r[1] ) {
                $pass_count++;
        }
}
$total = count( $results );
$all_ok = $pass_count === $total;
echo "\n=== RÉSULTAT : $pass_count PASS / " . ( $total - $pass_count ) . " FAIL ===";
if ( ! $all_ok ) {
        echo "\n>>> Envoyez TOUT le texte ci-dessus à Super Z pour correction.";
}
echo "\n</pre>";
