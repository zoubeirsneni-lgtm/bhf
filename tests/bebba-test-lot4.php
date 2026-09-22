<?php
/**
 * BEBBA — Harnais de test automatique du LOT 4 (plugin v0.4.2)
 *
 * À COPIER dans la racine WordPress (C:\wamp64\www\bebbabhf\) puis ouvrir :
 *   http://localhost/bebbabhf/bebba-test-lot4.php
 *
 * ⚠️ FICHIER TEMPORAIRE DE TEST : à SUPPRIMER après usage.
 * ⚠️ Crée des comptes de démonstration (admin/kitchen/readonly/drivers/client), des
 *    entités de catalogue temporaires (nettoyées par les tests), 1 commande invitée,
 *    puis FINIT PAR POST /reset-demo-data : TOUTES les commandes existantes (y compris
 *    celles des passages précédents du harnais LOT 3) sont supprimées, les stocks de la
 *    seed LOT 2 et le compteur (1100) sont restaurés, les clients et livreurs aussi.
 *    Le catalogue et les comptes staff sont préservés ; les 3 comptes staff de test
 *    sont supprimés par le harnais à la fin.
 *
 * Couvre : RBAC admin (401/403), CRUD catégories/produits(+relations)/suppléments/
 * ingrédients, ajustements de stock + mouvements, fournisseurs, livreurs (compte
 * atomique, statut, reset mot de passe + révocation token, protection historique),
 * comptes staff (rôles refusés, unicité), stats, reset-demo-data, isolation wp_users.
 *
 * REV 2 (correctif après le 1er passage : 4 PASS / 51 FAIL) :
 *  - Le FAIL massif venait du PLUGIN v0.4.0 : /auth/login exigeait identifier/mode
 *    (rest_missing_callback_param) et rejetait le contrat Express {username, password}.
 *    Corrigé dans le plugin v0.4.1 — T2 teste désormais le CONTRAT REEL du frontend.
 *  - T3 : numéro de téléphone ALÉATOIRE (comme le LOT 3) au lieu du fixe 99123456
 *    (déjà pris après un premier passage) + pré-nettoyage idempotent ci-dessous.
 *
 * REV 3 (correctif après le 2e passage : 50 PASS / 5 FAIL) :
 *  - T1 échouait car l'ANCIEN harnais (rev 1) tournait encore à la racine WP
 *    (libellé « version 0.4.0 ») alors que le plugin répondait 0.4.1 : BIEN
 *    REMPLACER ce fichier à chaque pack.
 *  - T12a : le payload utilisait ing-legumes (unité g en seed) mais attendait
 *    ml -> l'intention du test (résolution de l'unité) est restaurée avec
 *    ing-sauce-yaourt (Sauce yaourt, ml).
 *  - T17k/T18a : productId 'prod-poulet-bowl' inexistant (seed :
 *    'prod-chicken-bowl') -> commande jamais créée -> DELETE livreur 200 et
 *    todayOrdersCount 0. Corrigé ; le détail de T17k affiche aussi le code
 *    HTTP de la création de commande pour diagnostiquer en un coup d'œil.
 *  - T18c était un BUG PLUGIN (0.4.1) : users.phone UNIQUE + insert phone=''
 *    -> 2e compte staff sans phone en échec silencieux. Corrigé en v0.4.2
 *    (phone NULL) — cf. REPORT_LOT_4.md CORRECTION 2.
 *
 * REV 4 (correctif après le 3e passage : 53 PASS / 2 FAIL, plugin 0.4.2 sain) :
 *  - T17k/T18a : la commande invitée utilisait client.'address' mais le moteur
 *    (comme Express, server.ts l.927) lit client.'deliveryAddress' → POST /orders
 *    400 (trace order=400 du rev 3). Payload aligné sur le harnais LOT 3 (30/30) :
 *    'deliveryAddress' + 'notes', sans 'paymentMethod'. Plugins/harnais : SEUL
 *    ce fichier change, le plugin reste en 0.4.2.
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

/* Pré-nettoyage idempotent : supprime les restes d'un passage précédent qui
 * aurait échoué avant le reset final (tables du PLUGIN uniquement — jamais
 * wp_users : les livreurs n'ont pas de compte WP, cf. T20). */
$wpdb->query( "DELETE FROM " . Bebba_HF_DB::users_table() . " WHERE username IN ('test-admin-lot4','test-kitchen-lot4','test-readonly-lot4','test-driver-lot4','test-driver-lot4b')" );
$wpdb->query( "DELETE FROM " . Bebba_HF_DB::drivers_table() . " WHERE phone IN ('99000003','99000004')" );
$wpdb->query( "DELETE FROM " . Bebba_HF_DB::users_table() . " WHERE role = 'client' AND phone = '99123456'" );

echo "=== BEBBA TESTS LOT 4 (plugin " . esc_html( BEBBA_HF_VERSION ) . ") ===\n\n";

/* ---------------------------------------------------------------- T1 health */
list( $code, $body ) = bebba_http( 'GET', '/health' );
bebba_test( 'T1 health version 0.4.2', 200 === $code && '0.4.2' === (string) ( $body['version'] ?? '' ), "code=$code body=" . wp_json_encode( $body ) );

/* --------------------------------------------- T2 compte admin de test (DB) */
// Le mot de passe du seed admin est connu du client seul : le harnais cree son
// propre compte admin directement en base (meme hash bcrypt cost 10), puis
// passe par la REST pour tout le reste.
$wpdb->insert(
        Bebba_HF_DB::users_table(),
        array(
                'username'      => 'test-admin-lot4',
                'name'          => 'Test Admin LOT4',
                'phone'         => '99000001',
                'password_hash' => Bebba_HF_Auth::hash_password( 'pass-admin-1234' ),
                'role'          => 'admin',
                'active'        => 1,
                'token_version' => 0,
        ),
        array( '%s', '%s', '%s', '%s', '%s', '%d', '%d' )
);

list( $code, $login ) = bebba_http( 'POST', '/auth/login', array(
        'username' => 'test-admin-lot4',
        'password' => 'pass-admin-1234',
) );
$admin_token = (string) ( $login['token'] ?? '' );
bebba_test( 'T2 login admin (compte de test) → 200 + rôle admin', 200 === $code && 'admin' === (string) ( $login['user']['role'] ?? '' ) && '' !== $admin_token, "code=$code body=" . wp_json_encode( $login ) );

/* ------------------------------------------------------- T3 client de test */
$client_phone = '216' . random_int( 10000000, 99999999 ); // Aléatoire : ré-inscriptible après un 1er passage (comme le LOT 3).
list( $code, $reg ) = bebba_http( 'POST', '/auth/register-client', array(
        'name'     => 'Client Test LOT4',
        'phone'    => $client_phone,
        'password' => 'pass-client-1234',
) );
$client_token = (string) ( $reg['token'] ?? '' );
bebba_test( 'T3 inscription client → 201 + token', 201 === $code && '' !== $client_token && 'client' === (string) ( $reg['user']['role'] ?? '' ), "code=$code body=" . wp_json_encode( $reg ) );

/* ------------------------------------------------------------------ T4/T5 users */
list( $code, $users ) = bebba_http( 'GET', '/users', null, bebba_bearer( $admin_token ) );
$no_hash = true;
foreach ( ( $users ?: array() ) as $u ) {
        if ( isset( $u['passwordHash'] ) || isset( $u['password_hash'] ) ) {
                $no_hash = false;
        }
}
$has_test_admin = false;
foreach ( ( $users ?: array() ) as $u ) {
        if ( 'test-admin-lot4' === (string) ( $u['username'] ?? '' ) ) {
                $has_test_admin = true;
        }
}
bebba_test( 'T4 GET /users (admin) → liste sans hash, contient le compte de test', 200 === $code && is_array( $users ) && count( $users ) >= 2 && $no_hash && $has_test_admin, "code=$code n=" . ( is_array( $users ) ? count( $users ) : 0 ) );

list( $code, $err ) = bebba_http( 'GET', '/users', null, bebba_bearer( $client_token ) );
bebba_test( 'T5 GET /users (client) → 403', 403 === $code, "code=$code body=" . wp_json_encode( $err ) );

list( $code, $kitchen ) = bebba_http( 'POST', '/users', array(
        'username' => 'test-kitchen-lot4',
        'password' => 'pass-kitchen-1234',
        'name'     => 'Test Kitchen LOT4',
        'role'     => 'kitchen',
), bebba_bearer( $admin_token ) );
bebba_test( 'T6 POST /users (kitchen) → 201, sans hash', 201 === $code && 'kitchen' === (string) ( $kitchen['role'] ?? '' ) && ! isset( $kitchen['passwordHash'] ), "code=$code body=" . wp_json_encode( $kitchen ) );

list( $code, $err ) = bebba_http( 'POST', '/users', array(
        'username' => 'x-driver',
        'password' => 'pass-x-1234',
        'role'     => 'driver',
), bebba_bearer( $admin_token ) );
bebba_test( 'T7 POST /users role=driver → 400 message exact', 400 === $code && 'Les comptes livreurs doivent être créés via la gestion des livreurs.' === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

list( $code, $err ) = bebba_http( 'POST', '/users', array(
        'username' => 'x-client',
        'password' => 'pass-x-1234',
        'role'     => 'client',
), bebba_bearer( $admin_token ) );
bebba_test( 'T8 POST /users role=client → 400 message exact', 400 === $code && 'Les comptes clients doivent être créés via l’inscription client (/api/auth/register-client).' === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

list( $code, $err ) = bebba_http( 'POST', '/users', array(
        'username' => 'test-admin-lot4',
        'password' => 'pass-x-1234',
        'role'     => 'admin',
), bebba_bearer( $admin_token ) );
bebba_test( 'T9 POST /users doublon → 400 "Ce nom d’utilisateur est déjà utilisé."', 400 === $code && 'Ce nom d’utilisateur est déjà utilisé.' === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

/* --------------------------------------------------------------- T10 catégories */
list( $code, $cat ) = bebba_http( 'POST', '/categories', array( 'name' => 'Catégorie Test LOT4' ), bebba_bearer( $admin_token ) );
$cat_id = (string) ( $cat['id'] ?? '' );
bebba_test( 'T10a POST /categories → 201 + slug auto + icône Utensils', 201 === $code && '' !== $cat_id && 'cat-gorie-test-lot4' === (string) ( $cat['slug'] ?? '' ) && 'Utensils' === (string) ( $cat['icon'] ?? '' ), "code=$code body=" . wp_json_encode( $cat ) );

list( $code, $cat2 ) = bebba_http( 'PUT', '/categories/' . rawurlencode( $cat_id ), array( 'name' => 'Catégorie Test LOT4 v2', 'active' => false ), bebba_bearer( $admin_token ) );
bebba_test( 'T10b PUT /categories/:id → 200 mise à jour', 200 === $code && 'Catégorie Test LOT4 v2' === (string) ( $cat2['name'] ?? '' ) && false === ( $cat2['active'] ?? null ), "code=$code body=" . wp_json_encode( $cat2 ) );

list( $code, $del ) = bebba_http( 'DELETE', '/categories/' . rawurlencode( $cat_id ), null, bebba_bearer( $admin_token ) );
bebba_test( 'T10c DELETE /categories/:id → 200 {success:true}', 200 === $code && true === ( $del['success'] ?? null ), "code=$code body=" . wp_json_encode( $del ) );

/* ----------------------------------------------------------------- T11 produits */
$product_payload = array(
        'name'        => 'Produit Test LOT4',
        'categoryId'  => 'cat-bowls',
        'basePrice'   => 10,
        'description' => 'Plat de test LOT 4',
        'calories'    => 600,
        'baseIngredients' => array(
                array( 'ingredientId' => 'ing-poulet', 'quantity' => 200, 'unit' => 'g' ),
        ),
        'customization' => array(
                'proteinOptions'       => array( array( 'label' => 'Test +50g', 'extraPrice' => 1, 'extraGrams' => 50 ) ),
                'veggiesOptions'       => array( array( 'label' => 'Double légumes test', 'extraPrice' => 0.5, 'extraGrams' => 30 ) ),
                'baseChoices'          => array( array( 'label' => 'Base test', 'extraPrice' => 0 ) ),
                'allowedSupplementIds' => array( 'sup-poulet-extra' ),
        ),
);
list( $code, $prod ) = bebba_http( 'POST', '/products', $product_payload, bebba_bearer( $admin_token ) );
$prod_id = (string) ( $prod['id'] ?? '' );
bebba_test( 'T11a POST /products → 201 avec relations résolues', 201 === $code && '' !== $prod_id
        && 1 === count( (array) ( $prod['baseIngredients'] ?? array() ) )
        && 'ing-poulet' === (string) ( $prod['baseIngredients'][0]['ingredientId'] ?? '' )
        && 'Poulet fermier' === (string) ( $prod['baseIngredients'][0]['ingredientName'] ?? '' ), "code=$code body=" . wp_json_encode( $prod ) );

list( $code, $prod_get ) = bebba_http( 'GET', '/products/' . rawurlencode( $prod_id ) );
bebba_test( 'T11b GET /products/:id → customization reconstituée depuis les tables', 200 === $code
        && 'Test +50g' === (string) ( $prod_get['customization']['proteinOptions'][0]['label'] ?? '' )
        && 'Double légumes test' === (string) ( $prod_get['customization']['veggiesOptions'][0]['label'] ?? '' )
        && 'Base test' === (string) ( $prod_get['customization']['baseChoices'][0]['label'] ?? '' )
        && 'sup-poulet-extra' === (string) ( $prod_get['customization']['allowedSupplementIds'][0] ?? '' ), "code=$code body=" . wp_json_encode( $prod_get ) );

$product_payload['basePrice'] = 11;
list( $code, $prod2 ) = bebba_http( 'PUT', '/products/' . rawurlencode( $prod_id ), $product_payload, bebba_bearer( $admin_token ) );
bebba_test( 'T11c PUT /products/:id → 200 prix mis à jour', 200 === $code && abs( (float) ( $prod2['basePrice'] ?? 0 ) - 11.0 ) < 0.001, "code=$code body=" . wp_json_encode( $prod2 ) );

list( $code, $del ) = bebba_http( 'DELETE', '/products/' . rawurlencode( $prod_id ), null, bebba_bearer( $admin_token ) );
bebba_test( 'T11d DELETE /products/:id → 200 puis 404', 200 === $code && true === ( $del['success'] ?? null ), "code=$code body=" . wp_json_encode( $del ) );
list( $code, $err ) = bebba_http( 'GET', '/products/' . rawurlencode( $prod_id ) );
bebba_test( 'T11e produit supprimé → 404 "Produit non trouvé."', 404 === $code && 'Produit non trouvé.' === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

/* -------------------------------------------------------------- T12 suppléments */
list( $code, $sup ) = bebba_http( 'POST', '/supplements', array(
        'name'             => 'Supplément Test LOT4',
        'price'            => 2,
        'ingredientId'     => 'ing-sauce-yaourt',
        'quantityConsumed' => 50,
), bebba_bearer( $admin_token ) );
$sup_id = (string) ( $sup['id'] ?? '' );
bebba_test( 'T12a POST /supplements → 201, ingrédient résolu (nom + unité ml)', 201 === $code && '' !== $sup_id
        && 'Sauce yaourt' === (string) ( $sup['ingredientName'] ?? '' )
        && 'ml' === (string) ( $sup['unit'] ?? '' )
        && abs( (float) ( $sup['quantityConsumed'] ?? 0 ) - 50.0 ) < 0.001, "code=$code body=" . wp_json_encode( $sup ) );

list( $code, $sup2 ) = bebba_http( 'PUT', '/supplements/' . rawurlencode( $sup_id ), array(
        'name'  => 'Supplément Test LOT4',
        'price' => 2.5,
        'ingredientId' => 'ing-legumes',
), bebba_bearer( $admin_token ) );
bebba_test( 'T12b PUT /supplements/:id → 200 prix mis à jour', 200 === $code && abs( (float) ( $sup2['price'] ?? 0 ) - 2.5 ) < 0.001, "code=$code body=" . wp_json_encode( $sup2 ) );

list( $code, $del ) = bebba_http( 'DELETE', '/supplements/' . rawurlencode( $sup_id ), null, bebba_bearer( $admin_token ) );
bebba_test( 'T12c DELETE /supplements/:id → 200 puis 404', 200 === $code && true === ( $del['success'] ?? null ), "code=$code body=" . wp_json_encode( $del ) );
list( $code, $err ) = bebba_http( 'GET', '/supplements/' . rawurlencode( $sup_id ) );
bebba_test( 'T12d supplément supprimé → 404 "Supplément non trouvé."', 404 === $code && 'Supplément non trouvé.' === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

/* ------------------------------------------------------------- T13 ingrédients */
list( $code, $ings ) = bebba_http( 'GET', '/ingredients', null, bebba_bearer( $admin_token ) );
$has_poulet = false;
foreach ( ( $ings ?: array() ) as $ing ) {
        if ( 'ing-poulet' === (string) ( $ing['id'] ?? '' ) ) {
                $has_poulet = true;
        }
}
bebba_test( 'T13a GET /ingredients (admin) → liste avec ing-poulet', 200 === $code && is_array( $ings ) && $has_poulet, "code=$code n=" . ( is_array( $ings ) ? count( $ings ) : 0 ) );

list( $code, $err ) = bebba_http( 'GET', '/ingredients', null, bebba_bearer( $client_token ) );
bebba_test( 'T13b GET /ingredients (client) → 403', 403 === $code, "code=$code body=" . wp_json_encode( $err ) );

/* T14 : cycle de vie complet d'un ingrédient */
list( $code, $ing ) = bebba_http( 'POST', '/ingredients', array(
        'name'         => 'Ingrédient Test LOT4',
        'unit'         => 'g',
        'currentStock' => 1000,
        'minThreshold' => 100,
        'purchaseCost' => 5,
        'category'     => 'Test',
), bebba_bearer( $admin_token ) );
$ing_id = (string) ( $ing['id'] ?? '' );
bebba_test( 'T14a POST /ingredients → 201 avec currentStock 1000', 201 === $code && '' !== $ing_id && abs( (float) ( $ing['currentStock'] ?? 0 ) - 1000.0 ) < 0.001, "code=$code body=" . wp_json_encode( $ing ) );

list( $code, $err ) = bebba_http( 'DELETE', '/ingredients/' . rawurlencode( $ing_id ), null, bebba_bearer( $admin_token ) );
bebba_test( 'T14b DELETE ingrédient actif → 400 message exact', 400 === $code && "Impossible de supprimer un ingrédient actif. Veuillez d'abord le désactiver." === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

list( $code, $ing2 ) = bebba_http( 'PUT', '/ingredients/' . rawurlencode( $ing_id ), array(
        'name' => 'Ingrédient Test LOT4', 'unit' => 'g', 'currentStock' => 1000, 'minThreshold' => 100, 'active' => false,
), bebba_bearer( $admin_token ) );
bebba_test( 'T14c PUT /ingredients/:id (active:false) → 200', 200 === $code && false === ( $ing2['active'] ?? null ), "code=$code body=" . wp_json_encode( $ing2 ) );

list( $code, $del ) = bebba_http( 'DELETE', '/ingredients/' . rawurlencode( $ing_id ), null, bebba_bearer( $admin_token ) );
bebba_test( 'T14d DELETE ingrédient désactivé → 200', 200 === $code && true === ( $del['success'] ?? null ), "code=$code body=" . wp_json_encode( $del ) );
list( $code, $err ) = bebba_http( 'DELETE', '/ingredients/' . rawurlencode( $ing_id ), null, bebba_bearer( $admin_token ) );
bebba_test( 'T14e DELETE ingrédient absent → 400 "Ingrédient introuvable."', 400 === $code && 'Ingrédient introuvable.' === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

/* --------------------------------------------- T15 ajustements de stock */
$poulet_before = bebba_stock( 'ing-poulet' );
list( $code, $stk ) = bebba_http( 'POST', '/ingredients/ing-poulet/stock', array(
        'type'     => 'replenishment',
        'quantity' => 500,
        'notes'    => 'Test LOT4 réappro',
), bebba_bearer( $admin_token ) );
$poulet_after = bebba_stock( 'ing-poulet' );
bebba_test( 'T15a POST /ingredients/:id/stock (+500) → 200, stock +500 en base', 200 === $code
        && abs( ( $poulet_after - $poulet_before ) - 500.0 ) < 0.001
        && 'Poulet fermier' === (string) ( $stk['ingredient']['name'] ?? '' )
        && 'replenishment' === (string) ( $stk['movement']['type'] ?? '' )
        && 'Test Admin LOT4 (Admin)' === (string) ( $stk['movement']['performedBy'] ?? '' ), "code=$code body=" . wp_json_encode( $stk ) );

list( $code, $movs ) = bebba_http( 'GET', '/stock-movements', null, bebba_bearer( $admin_token ) );
$first = ( $movs ?: array() )[0] ?? array();
bebba_test( 'T15b GET /stock-movements → 1er mouvement = réappro du T15a (tri desc)', 200 === $code && is_array( $movs )
        && 'replenishment' === (string) ( $first['type'] ?? '' )
        && abs( (float) ( $first['quantity'] ?? 0 ) - 500.0 ) < 0.001, "code=$code first=" . wp_json_encode( $first ) );

list( $code, $err ) = bebba_http( 'POST', '/ingredients/ing-poulet/stock', array( 'quantity' => 'abc' ), bebba_bearer( $admin_token ) );
bebba_test( 'T15c quantité invalide → 400 "Quantité invalide."', 400 === $code && 'Quantité invalide.' === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

list( $code, $err ) = bebba_http( 'POST', '/ingredients/ing-ghost/stock', array( 'quantity' => 10 ), bebba_bearer( $admin_token ) );
bebba_test( 'T15d ingrédient inconnu → 400 "Ingrédient #ing-ghost introuvable."', 400 === $code && 'Ingrédient #ing-ghost introuvable.' === (string) ( $err['error'] ?? '' ), "code=$code body=" . wp_json_encode( $err ) );

/* T15e : la cuisine a aussi accès à l'ajustement de stock (RBAC) */
list( $code, $klogin ) = bebba_http( 'POST', '/auth/login', array(
        'username' => 'test-kitchen-lot4',
        'password' => 'pass-kitchen-1234',
) );
$kitchen_token = (string) ( $klogin['token'] ?? '' );
$legumes_before = bebba_stock( 'ing-legumes' );
list( $code, $stk2 ) = bebba_http( 'POST', '/ingredients/ing-legumes/stock', array( 'quantity' => 10 ), bebba_bearer( $kitchen_token ) );
bebba_test( 'T15e stock via rôle cuisine → 200, performer "(Cuisine)"', 200 === $code
        && abs( ( bebba_stock( 'ing-legumes' ) - $legumes_before ) - 10.0 ) < 0.001
        && 'Test Kitchen LOT4 (Cuisine)' === (string) ( $stk2['movement']['performedBy'] ?? '' ), "code=$code body=" . wp_json_encode( $stk2 ) );

/* -------------------------------------------------------------- T16 fournisseurs */
list( $code, $sups ) = bebba_http( 'GET', '/suppliers', null, bebba_bearer( $admin_token ) );
$has_sup1 = false;
foreach ( ( $sups ?: array() ) as $s ) {
        if ( 'sup-1' === (string) ( $s['id'] ?? '' ) ) {
                $has_sup1 = true;
        }
}
bebba_test( 'T16a GET /suppliers → liste contenant sup-1', 200 === $code && is_array( $sups ) && $has_sup1, "code=$code n=" . ( is_array( $sups ) ? count( $sups ) : 0 ) );

list( $code, $sup1 ) = bebba_http( 'POST', '/suppliers', array(
        'name'  => 'Fournisseur Test LOT4',
        'phone' => '71900001',
), bebba_bearer( $admin_token ) );
$sup1_id = (string) ( $sup1['id'] ?? '' );
bebba_test( 'T16b POST /suppliers → 200 (Express : pas de 201 ici)', 200 === $code && '' !== $sup1_id && 'Fournisseur Test LOT4' === (string) ( $sup1['name'] ?? '' ), "code=$code body=" . wp_json_encode( $sup1 ) );

list( $code, $sup2r ) = bebba_http( 'PUT', '/suppliers/' . rawurlencode( $sup1_id ), array(
        'name'  => 'Fournisseur Test LOT4',
        'phone' => '71900002',
), bebba_bearer( $admin_token ) );
bebba_test( 'T16c PUT /suppliers/:id → 200 téléphone mis à jour', 200 === $code && '71900002' === (string) ( $sup2r['phone'] ?? '' ), "code=$code body=" . wp_json_encode( $sup2r ) );

list( $code, $del ) = bebba_http( 'DELETE', '/suppliers/' . rawurlencode( $sup1_id ), null, bebba_bearer( $admin_token ) );
bebba_test( 'T16d DELETE /suppliers/:id → 200', 200 === $code && true === ( $del['success'] ?? null ), "code=$code body=" . wp_json_encode( $del ) );

/* -------------------------------------------------------------- T17 livreurs */
list( $code, $drv ) = bebba_http( 'POST', '/drivers', array(
        'name'     => 'Livreur Test LOT4',
        'phone'    => '99000003',
        'username' => 'test-driver-lot4',
        'password' => 'pass-driver-1234',
        'vehicle'  => 'Moto test',
), bebba_bearer( $admin_token ) );
$drv_id = (string) ( $drv['driver']['id'] ?? '' );
$drv_num = 0;
$row = $wpdb->get_row( $wpdb->prepare( 'SELECT id FROM ' . Bebba_HF_DB::drivers_table() . ' WHERE legacy_id = %s', $drv_id ), ARRAY_A );
if ( $row ) {
        $drv_num = (int) $row['id'];
}
bebba_test( 'T17a POST /drivers → 201 création ATOMIQUE livreur + compte', 201 === $code && '' !== $drv_id
        && 'test-driver-lot4' === (string) ( $drv['driver']['username'] ?? '' )
        && 'driver' === (string) ( $drv['user']['role'] ?? '' )
        && ! isset( $drv['user']['passwordHash'] ), "code=$code body=" . wp_json_encode( $drv ) );

list( $code, $drvs ) = bebba_http( 'GET', '/drivers', null, bebba_bearer( $admin_token ) );
$found = false;
foreach ( ( $drvs ?: array() ) as $d ) {
        if ( $drv_id === (string) ( $d['id'] ?? '' ) && 'test-driver-lot4' === (string) ( $d['username'] ?? '' ) ) {
                $found = true;
        }
}
bebba_test( 'T17b GET /drivers → livreur présent avec username', 200 === $code && $found, "code=$code body=" . wp_json_encode( $drvs ) );

list( $code, $dlogin ) = bebba_http( 'POST', '/auth/login', array(
        'username' => 'test-driver-lot4',
        'password' => 'pass-driver-1234',
) );
$drv_token_old = (string) ( $dlogin['token'] ?? '' );
bebba_test( 'T17c login livreur → 200', 200 === $code && '' !== $drv_token_old, "code=$code body=" . wp_json_encode( $dlogin ) );

list( $code, $drv2 ) = bebba_http( 'PUT', '/drivers/' . rawurlencode( $drv_id ), array( 'vehicle' => 'Camion test' ), bebba_bearer( $admin_token ) );
bebba_test( 'T17d PUT /drivers/:id → 200 véhicule mis à jour', 200 === $code && 'Camion test' === (string) ( $drv2['vehicle'] ?? '' ), "code=$code body=" . wp_json_encode( $drv2 ) );

list( $code, $st ) = bebba_http( 'PATCH', '/drivers/' . rawurlencode( $drv_id ) . '/status', array( 'active' => false ), bebba_bearer( $admin_token ) );
bebba_test( 'T17e PATCH status active:false → success, compte désactivé', 200 === $code && true === ( $st['success'] ?? null ) && false === ( $st['driver']['active'] ?? null ), "code=$code body=" . wp_json_encode( $st ) );
list( $code, $err ) = bebba_http( 'POST', '/auth/login', array(
        'username' => 'test-driver-lot4',
        'password' => 'pass-driver-1234',
) );
bebba_test( 'T17f login livreur désactivé → 401', 401 === $code, "code=$code body=" . wp_json_encode( $err ) );
list( $code, $st ) = bebba_http( 'PATCH', '/drivers/' . rawurlencode( $drv_id ) . '/status', array( 'active' => true ), bebba_bearer( $admin_token ) );
bebba_test( 'T17g PATCH status active:true → réactivé', 200 === $code && true === ( $st['driver']['active'] ?? null ), "code=$code body=" . wp_json_encode( $st ) );

list( $code, $pw ) = bebba_http( 'PATCH', '/drivers/' . rawurlencode( $drv_id ) . '/password', array( 'newPassword' => 'pass-new-9999' ), bebba_bearer( $admin_token ) );
bebba_test( 'T17h PATCH password → message exact', 200 === $code && true === ( $pw['success'] ?? null ) && 'Mot de passe réinitialisé avec succès.' === (string) ( $pw['message'] ?? '' ), "code=$code body=" . wp_json_encode( $pw ) );
list( $code, $err ) = bebba_http( 'GET', '/auth/me', null, bebba_bearer( $drv_token_old ) );
bebba_test( 'T17i ancien token livreur révoqué → 401 (token_version)', 401 === $code, "code=$code body=" . wp_json_encode( $err ) );
list( $code, $dlogin2 ) = bebba_http( 'POST', '/auth/login', array(
        'username' => 'test-driver-lot4',
        'password' => 'pass-new-9999',
) );
bebba_test( 'T17j login avec le nouveau mot de passe → 200', 200 === $code && '' !== (string) ( $dlogin2['token'] ?? '' ), "code=$code body=" . wp_json_encode( $dlogin2 ) );

/* T17k : protection historique — 1 commande invitée assignée au livreur (simulation en base) */
$order_payload = array(
        'client' => array(
                'name'            => 'Client Test LOT4',
                'phone'           => '99123456',
                'deliveryAddress' => '12 rue du Test, Tunis', // champ du contrat (client.'address' => 400, rev 4)
                'notes'           => 'Sans oignons',
        ),
        'items'         => array( array(
                'productId'           => 'prod-chicken-bowl',
                'quantity'            => 1,
                'proteinOption'       => array( 'label' => 'Portion sportive (+100g)' ),
                'veggiesOption'       => array( 'label' => 'Double légumes (+50g)' ),
                'baseChoice'          => array( 'label' => 'Base quinoa' ),
                'supplements'         => array( array( 'id' => 'sup-poulet-extra', 'quantity' => 1 ) ),
                'specialInstructions' => 'Bien croustillant',
        ) ),
);
list( $code, $order ) = bebba_http( 'POST', '/orders', $order_payload );
$order_code = $code; // tracé dans le détail de T17k (rev 3).
$order_msg = is_array( $order ) ? (string) ( $order['error'] ?? '' ) : ''; // rev 4.
$guest_token_val = (string) ( is_array( $order ) ? ( $order['trackingToken'] ?? '' ) : '' );
$guest_order_id  = 0;
if ( '' !== $guest_token_val ) {
        $guest_order_id = (int) $wpdb->get_var( $wpdb->prepare(
                'SELECT id FROM ' . Bebba_HF_DB::orders_table() . ' WHERE tracking_token = %s',
                $guest_token_val
        ) );
}
if ( $guest_order_id <= 0 ) {
        $guest_order_id = (int) $wpdb->get_var( 'SELECT MAX(id) FROM ' . Bebba_HF_DB::orders_table() );
}
if ( $guest_order_id > 0 && $drv_num > 0 ) {
        $wpdb->query( $wpdb->prepare( 'UPDATE ' . Bebba_HF_DB::orders_table() . ' SET driver_id = %d WHERE id = %d', $drv_num, $guest_order_id ) );
}
list( $code, $err ) = bebba_http( 'DELETE', '/drivers/' . rawurlencode( $drv_id ), null, bebba_bearer( $admin_token ) );
bebba_test( 'T17k DELETE livreur avec commandes → 400 message exact', 400 === $code && 'Impossible de supprimer définitivement le livreur "Livreur Test LOT4" car des commandes historiques lui sont associées. Veuillez le désactiver.' === (string) ( $err['error'] ?? '' ), "order=$order_code " . ( '' !== $order_msg ? 'orderMsg=' . $order_msg . ' ' : '' ) . "code=$code body=" . wp_json_encode( $err ) );

/* T17l : suppression sans historique → driver + compte supprimés */
list( $code, $drv2c ) = bebba_http( 'POST', '/drivers', array(
        'name'     => 'Livreur Test LOT4 B',
        'phone'    => '99000004',
        'username' => 'test-driver-lot4b',
        'password' => 'pass-driver-1234',
), bebba_bearer( $admin_token ) );
$drv2_id = (string) ( $drv2c['driver']['id'] ?? '' );
list( $code, $del ) = bebba_http( 'DELETE', '/drivers/' . rawurlencode( $drv2_id ), null, bebba_bearer( $admin_token ) );
$left = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . Bebba_HF_DB::users_table() . ' WHERE username = %s', 'test-driver-lot4b' ) );
bebba_test( 'T17l DELETE livreur sans commandes → 200, compte supprimé aussi', 200 === $code && true === ( $del['success'] ?? null ) && 0 === $left, "code=$code body=" . wp_json_encode( $del ) );

/* ------------------------------------------------------------------ T18 stats */
list( $code, $stats ) = bebba_http( 'GET', '/stats', null, bebba_bearer( $admin_token ) );
$sc = is_array( $stats ) ? ( $stats['statusCounts'] ?? array() ) : array();
bebba_test( 'T18a GET /stats (admin) → 7 compteurs + commandes du jour ≥ 1', 200 === $code
        && 7 === count( $sc )
        && isset( $sc['received'], $sc['preparing'], $sc['ready'], $sc['waiting_for_driver'], $sc['delivering'], $sc['delivered'], $sc['cancelled'] )
        && (int) ( $stats['todayOrdersCount'] ?? 0 ) >= 1
        && is_array( $stats['topSellingProducts'] ?? null ), "code=$code body=" . wp_json_encode( $stats ) );

list( $code, $err ) = bebba_http( 'GET', '/stats', null, bebba_bearer( $client_token ) );
bebba_test( 'T18b GET /stats (client) → 403', 403 === $code, "code=$code body=" . wp_json_encode( $err ) );

list( $code, $ro ) = bebba_http( 'POST', '/users', array(
        'username' => 'test-readonly-lot4',
        'password' => 'pass-readonly-1234',
        'name'     => 'Test Readonly LOT4',
        'role'     => 'admin_readonly',
), bebba_bearer( $admin_token ) );
list( $code, $rol ) = bebba_http( 'POST', '/auth/login', array(
        'username' => 'test-readonly-lot4',
        'password' => 'pass-readonly-1234',
) );
$ro_token = (string) ( $rol['token'] ?? '' );
list( $code, $x ) = bebba_http( 'GET', '/stats', null, bebba_bearer( $ro_token ) );
$ro_stats_ok = 200 === $code;
list( $code, $x ) = bebba_http( 'GET', '/stock-movements', null, bebba_bearer( $ro_token ) );
$ro_mov_ok = 200 === $code;
list( $code, $x ) = bebba_http( 'POST', '/categories', array( 'name' => 'Interdit' ), bebba_bearer( $ro_token ) );
$ro_write_ok = 403 === $code;
bebba_test( 'T18c admin_readonly : stats + mouvements OK, écriture refusée (403)', $ro_stats_ok && $ro_mov_ok && $ro_write_ok, "stats=$ro_stats_ok mov=$ro_mov_ok write403=$ro_write_ok" );

/* ------------------------------------------------------------- T19 reset demo */
list( $code, $rst ) = bebba_http( 'POST', '/reset-demo-data', null, bebba_bearer( $admin_token ) );
$orders_after  = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . Bebba_HF_DB::orders_table() );
$drivers_after = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . Bebba_HF_DB::drivers_table() );
$clients_after = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . Bebba_HF_DB::users_table() . " WHERE role = 'client'" );
bebba_test( 'T19a POST /reset-demo-data → success, compteur 1100, stocks seed, base purgée', 200 === $code
        && true === ( $rst['success'] ?? null )
        && 1101 === (int) ( $rst['nextOrderSeq'] ?? 0 )
        && 1100 === bebba_counter()
        && 0 === $orders_after && 0 === $drivers_after && 0 === $clients_after
        && abs( bebba_stock( 'ing-poulet' ) - 8000.0 ) < 0.001
        && abs( bebba_stock( 'ing-quinoa' ) - 3000.0 ) < 0.001, "code=$code body=" . wp_json_encode( $rst ) );

list( $code, $cats ) = bebba_http( 'GET', '/categories' );
$cat_preserved = false;
foreach ( ( $cats ?: array() ) as $c ) {
        if ( 'cat-bowls' === (string) ( $c['id'] ?? '' ) ) {
                $cat_preserved = true;
        }
}
bebba_test( 'T19b catalogue préservé après reset (cat-bowls toujours là)', 200 === $code && $cat_preserved, "code=$code n=" . ( is_array( $cats ) ? count( $cats ) : 0 ) );

/* ------------------------------------------------------------- T20 isolation */
$wp_users_after = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . $wpdb->users );
bebba_test( 'T20 isolation : wp_users inchangé', $wp_users_before === $wp_users_after, "before=$wp_users_before after=$wp_users_after" );

/* ------------------------------------------------- nettoyage des comptes staff */
$wpdb->query( $wpdb->prepare(
        'DELETE FROM ' . Bebba_HF_DB::users_table() . ' WHERE username IN (%s,%s,%s)',
        'test-admin-lot4',
        'test-kitchen-lot4',
        'test-readonly-lot4'
) );
echo "\n[NETTOYAGE] comptes staff de test supprimés (test-admin-lot4, test-kitchen-lot4, test-readonly-lot4)\n";

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
