<?php
/**
 * Back-office admin — LOT 4.
 *
 * Portage 1:1 des routes admin de server.ts (decisions D3/D4) :
 *   - Categories  : POST/PUT/DELETE
 *   - Products    : POST/PUT/DELETE (relations baseIngredients + customization reecrites en transaction)
 *   - Supplements : POST/PUT/DELETE
 *   - Ingredients : GET/POST/PUT/DELETE + POST /:id/stock (ajustement manuel + mouvement)
 *   - Stock       : GET /stock-movements
 *   - Suppliers   : GET/POST/PUT/DELETE
 *   - Drivers     : GET/POST/PUT/PATCH status/PATCH password/DELETE (creation atomique driver + compte)
 *   - Users       : GET/POST (admin seulement, roles staff)
 *   - Stats       : GET (dashboard)
 *   - Reset       : POST /reset-demo-data (outil de demonstration)
 *
 * Contrats : messages d'erreur EXACTS de server.ts/db.ts (apostrophes typographiques
 * conservees), formats camelCase de src/types.ts, erreurs {"error": "..."}.
 * Les identifiants metier = legacy_id Firestore sinon id numerique en chaine.
 */

if ( ! defined( 'ABSPATH' ) ) {
        exit;
}

class Bebba_HF_Admin {

        /** Types de mouvement accepts par l'ENUM bebba_stock_movements.movement_type. */
        const MOVEMENT_TYPES = array(
                'order_consumption',
                'replenishment',
                'inventory_correction',
                'manual_out',
                'manual_in',
                'waste',
                'order_cancellation_restore',
        );

        /* ------------------------------------------------------------ helpers */

        /** ID metier expose au front : legacy_id Firestore sinon id numerique en chaine. */
        private static function biz_id( ?string $legacy, $numeric ): string {
                if ( $legacy !== null && $legacy !== '' ) {
                        return $legacy;
                }
                return (string) $numeric;
        }

        /** 'Y-m-d H:i:s' (UTC) → 'Y-m-dTH:i:sZ' (ISO 8601, meme format que toISOString()). */
        private static function iso( ?string $dt ): ?string {
                if ( ! $dt ) {
                        return null;
                }
                return str_replace( ' ', 'T', $dt ) . 'Z';
        }

        /** DECIMAL MySQL (chaine) → float|null. */
        private static function fl( $val ): ?float {
                return ( null === $val || '' === $val ) ? null : (float) $val;
        }

        private static function round1( $v ): float {
                return round( (float) $v * 10 ) / 10;
        }

        /** boolean JSON → 0/1 pour TINYINT (absent = true, comme Express `!== false`). */
        private static function bool01( $val ): int {
                return ( $val === false ) ? 0 : 1;
        }

        /** Valeur numerique DECIMAL (chaine MySQL 2 decimales) ou NULL. */
        private static function dec2( $val ): ?string {
                return null === $val ? null : number_format( (float) $val, 2, '.', '' );
        }

        /** Identifiant legacy genere (meme motif qu'Express : prefixe + Date.now()). */
        private static function uniq_legacy( string $prefix, bool $with_rand = false ): string {
                $ms = (string) (int) round( microtime( true ) * 1000 );
                return $prefix . $ms . ( $with_rand ? '-' . self::rand_hex( 4 ) : '' );
        }

        /** Suffixe hexadecimal lowercase (equivalent Math.random().toString(36), comme orders.php rand_hex). */
        private static function rand_hex( int $len ): string {
                $out = '';
                for ( $i = 0; $i < $len; $i++ ) {
                        $out .= dechex( random_int( 0, 15 ) );
                }
                return $out;
        }

        /** Slug Express : lowercase, [^a-z0-9]+ → '-', trim '-'. */
        private static function slugify( string $name ): string {
                $slug = preg_replace( '/[^a-z0-9]+/', '-', mb_strtolower( $name, 'UTF-8' ) );
                return trim( (string) $slug, '-' );
        }

        /** Recherche generique par ID metier (legacy_id, sinon id numerique). */
        private static function find_by_biz( string $table, string $biz ): ?array {
                global $wpdb;
                if ( '' === $biz ) {
                        return null;
                }
                if ( ctype_digit( $biz ) ) {
                        $row = $wpdb->get_row(
                                $wpdb->prepare( "SELECT * FROM {$table} WHERE legacy_id = %s OR id = %d LIMIT 1", $biz, (int) $biz ),
                                ARRAY_A
                        );
                } else {
                        $row = $wpdb->get_row(
                                $wpdb->prepare( "SELECT * FROM {$table} WHERE legacy_id = %s LIMIT 1", $biz ),
                                ARRAY_A
                        );
                }
                return $row ?: null;
        }

        /** Resolution d'un ingredient : ligne brute ou null (orphelin legacy possible). */
        private static function resolve_ingredient( string $biz ): ?array {
                return self::find_by_biz( Bebba_HF_DB::ingredients_table(), $biz );
        }

        private static function resolve_supplier( string $biz ): ?array {
                return self::find_by_biz( Bebba_HF_DB::suppliers_table(), $biz );
        }

        private static function resolve_supplement( string $biz ): ?array {
                return self::find_by_biz( Bebba_HF_DB::supplements_table(), $biz );
        }

        private static function resolve_category( string $biz ): ?array {
                return self::find_by_biz( Bebba_HF_DB::categories_table(), $biz );
        }

        /** Livreur par ID metier. */
        private static function resolve_driver( string $biz ): ?array {
                return self::find_by_biz( Bebba_HF_DB::drivers_table(), $biz );
        }

        /** Compte utilisateur lie a un livreur (id numerique). */
        private static function user_of_driver( int $driver_id ): ?array {
                global $wpdb;
                $u = Bebba_HF_DB::users_table();
                $r = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$u} WHERE driver_id = %d ORDER BY id ASC LIMIT 1", $driver_id ), ARRAY_A );
                return $r ?: null;
        }

        /** Comptage generique. */
        private static function count_of( string $sql ): int {
                global $wpdb;
                return (int) $wpdb->get_var( $sql );
        }

        /**
         * INSERT avec support des NULL (wpdb ne les gere pas via %d/%s).
         * Les noms de colonnes proviennent exclusivement du code (jamais d'entree utilisateur).
         */
        private static function insert_row( string $table, array $cols ): void {
                global $wpdb;
                $names = array();
                $ph    = array();
                $vals  = array();
                foreach ( $cols as $name => $v ) {
                        $names[] = $name;
                        if ( null === $v ) {
                                $ph[] = 'NULL';
                        } elseif ( is_int( $v ) ) {
                                $ph[]   = '%d';
                                $vals[] = $v;
                        } elseif ( is_float( $v ) ) {
                                $ph[]   = '%f';
                                $vals[] = $v;
                        } else {
                                $ph[]   = '%s';
                                $vals[] = $v;
                        }
                }
                $sql = "INSERT INTO {$table} (" . implode( ',', $names ) . ') VALUES (' . implode( ',', $ph ) . ')';
                $wpdb->query( $wpdb->prepare( $sql, $vals ) );
        }

        /** UPDATE avec support des NULL (meme principe que insert_row). */
        private static function update_row( string $table, array $cols, string $where ): void {
                global $wpdb;
                $sets = array();
                $vals = array();
                foreach ( $cols as $name => $v ) {
                        if ( null === $v ) {
                                $sets[] = "{$name} = NULL";
                        } elseif ( is_int( $v ) ) {
                                $sets[] = "{$name} = %d";
                                $vals[] = $v;
                        } elseif ( is_float( $v ) ) {
                                $sets[] = "{$name} = %f";
                                $vals[] = $v;
                        } else {
                                $sets[] = "{$name} = %s";
                                $vals[] = $v;
                        }
                }
                $sql = "UPDATE {$table} SET " . implode( ', ', $sets ) . " WHERE {$where}";
                $wpdb->query( $wpdb->prepare( $sql, $vals ) );
        }

        /* -------------------------------------------------------- formatteurs */

        /** Type Ingredient de src/types.ts (currentStock/minThreshold/purchaseCost non nuls). */
        public static function format_ingredient( array $r ): array {
                return array(
                        'id'            => self::biz_id( $r['legacy_id'], $r['id'] ),
                        'legacyId'      => $r['legacy_id'],
                        'name'          => $r['name'],
                        'unit'          => $r['unit'],
                        'currentStock'  => self::fl( $r['stock_quantity'] ) ?? 0.0,
                        'minThreshold'  => self::fl( $r['min_threshold'] ) ?? 0.0,
                        'purchaseCost'  => self::fl( $r['purchase_cost'] ) ?? 0.0,
                        'supplierId'    => '' !== (string) ( $r['supplier_legacy_id'] ?? '' ) || null !== ( $r['supplier_id'] ?? null )
                                ? self::biz_id( $r['supplier_legacy_id'] ?? null, $r['supplier_id'] ?? null )
                                : null,
                        'supplierName'  => $r['supplier_name_snapshot'] ?? null,
                        'category'      => $r['category'] ?? null,
                        'active'        => (int) $r['active'] === 1,
                        'createdAt'     => self::iso( $r['created_at'] ),
                        'updatedAt'     => self::iso( $r['updated_at'] ),
                );
        }

        /** Type StockMovement de src/types.ts. */
        public static function format_movement( array $r ): array {
                return array(
                        'id'             => $r['legacy_id'],
                        'ingredientId'   => self::biz_id( $r['ingredient_legacy_id'], $r['ingredient_id'] ),
                        'ingredientName' => $r['ingredient_name_snapshot'],
                        'type'           => $r['movement_type'],
                        'quantity'       => self::fl( $r['quantity'] ) ?? 0.0,
                        'unit'           => $r['unit'],
                        'orderId'        => ( $r['order_legacy_id'] ?? null ) || ( $r['order_id'] ?? null )
                                ? self::biz_id( $r['order_legacy_id'] ?? null, $r['order_id'] ?? null )
                                : null,
                        'orderNumber'    => $r['order_number_snapshot'] ?? null,
                        'notes'          => $r['notes'] ?? '',
                        'timestamp'      => self::iso( $r['timestamp'] ),
                        'performedBy'    => $r['performed_by'] ?? '',
                );
        }

        /** Type Supplier de src/types.ts (suppliedIngredients decode du JSON legacy). */
        public static function format_supplier( array $r ): array {
                $supplied = json_decode( (string) ( $r['supplied_ingredient_legacy_ids'] ?? '' ), true );
                return array(
                        'id'                  => self::biz_id( $r['legacy_id'], $r['id'] ),
                        'legacyId'            => $r['legacy_id'],
                        'name'                => $r['name'],
                        'phone'               => $r['phone'] ?? '',
                        'email'               => $r['email'] ?? '',
                        'address'             => $r['address'] ?? '',
                        'suppliedIngredients' => is_array( $supplied ) ? array_values( $supplied ) : array(),
                );
        }

        /** Type Driver de src/types.ts (+ username via la jointure bebba_users). */
        public static function format_driver( array $r, ?string $username = null ): array {
                $out = array(
                        'id'              => self::biz_id( $r['legacy_id'], $r['id'] ),
                        'legacyId'        => $r['legacy_id'],
                        'name'            => $r['name'],
                        'phone'           => $r['phone'],
                        'vehicle'         => $r['vehicle'] ?? '',
                        'active'          => (int) $r['active'] === 1,
                        'totalDeliveries' => (int) $r['total_deliveries'],
                        'rating'          => self::fl( $r['rating'] ?? null ),
                );
                if ( null !== $username ) {
                        $out['username'] = $username;
                }
                return $out;
        }

        /* --------------------------------------------------------- categories */

        /**
         * POST/PUT categories — (1:1 db.saveCategory : nom obligatoire, slug auto,
         * icone 'Utensils', sortOrder = sortOrder ?? order ?? 10).
         * $biz_id non null = PUT (l'id demande est cree s'il n'existe pas, comme setDoc).
         */
        public static function save_category( array $body, ?string $biz_id = null ): array {
                global $wpdb;

                $name = (string) ( $body['name'] ?? '' );
                if ( '' === trim( $name ) ) {
                        throw new Exception( 'Le nom de la catégorie est obligatoire.' );
                }

                $legacy = $biz_id
                        ?: ( isset( $body['id'] ) && '' !== (string) $body['id'] ? (string) $body['id'] : self::uniq_legacy( 'cat-' ) );

                $row = self::find_by_biz( Bebba_HF_DB::categories_table(), $legacy );

                $sort_order = isset( $body['sortOrder'] ) && null !== $body['sortOrder']
                        ? (int) $body['sortOrder']
                        : ( isset( $body['order'] ) && null !== $body['order'] ? (int) $body['order'] : 10 );

                $slug = (string) ( $body['slug'] ?? '' );
                if ( '' === $slug ) {
                        $slug = self::slugify( trim( $name ) );
                }
                if ( '' === $slug ) {
                        $slug = 'cat-item';
                }

                $image      = (string) ( $body['image'] ?? '' );
                $image_url  = (string) ( $body['imageUrl'] ?? '' );
                $vals       = array(
                        'name'        => trim( $name ),
                        'slug'        => $slug,
                        'icon'        => (string) ( $body['icon'] ?? '' ) !== '' ? (string) $body['icon'] : 'Utensils',
                        'image'       => '' !== $image ? $image : $image_url,
                        'image_url'   => '' !== $image_url ? $image_url : $image,
                        'description' => (string) ( $body['description'] ?? '' ),
                        'active'      => self::bool01( $body['active'] ?? null ),
                        'sort_order'  => $sort_order,
                        'legacy_order' => $sort_order,
                );

                if ( $row ) {
                        self::update_row( Bebba_HF_DB::categories_table(), $vals, 'id = ' . (int) $row['id'] );
                } else {
                        $vals['legacy_id'] = $legacy;
                        self::insert_row( Bebba_HF_DB::categories_table(), $vals );
                }

                $saved = Bebba_HF_Catalog::get_category( $legacy );
                if ( null === $saved ) {
                        throw new Exception( 'Échec de relecture après enregistrement de la catégorie.' );
                }
                return $saved;
        }

        /** DELETE categories — protegee si des produits y sont rattaches (1:1 db.deleteCategory). */
        public static function delete_category( string $biz_id ): array {
                global $wpdb;
                $p = Bebba_HF_DB::products_table();

                $row = self::find_by_biz( Bebba_HF_DB::categories_table(), $biz_id );
                if ( $row ) {
                        $used = ctype_digit( $biz_id )
                                ? self::count_of( $wpdb->prepare( "SELECT COUNT(*) FROM {$p} WHERE category_legacy_id = %s OR category_id = %d", $biz_id, (int) $biz_id ) )
                                : self::count_of( $wpdb->prepare( "SELECT COUNT(*) FROM {$p} WHERE category_legacy_id = %s", $biz_id ) );
                        if ( $used > 0 ) {
                                throw new Exception( 'Impossible de supprimer cette catégorie car des produits y sont rattachés.' );
                        }
                        $wpdb->delete( Bebba_HF_DB::categories_table(), array( 'id' => (int) $row['id'] ), array( '%d' ) );
                }
                return array( 'success' => true );
        }

        /* --------------------------------------------------------- suppliers */

        /** GET /suppliers (admin). */
        public static function list_suppliers(): array {
                global $wpdb;
                $t    = Bebba_HF_DB::suppliers_table();
                $rows = $wpdb->get_results( "SELECT * FROM {$t} ORDER BY id ASC", ARRAY_A );
                $out  = array();
                foreach ( ( $rows ?: array() ) as $r ) {
                        $out[] = self::format_supplier( $r );
                }
                return $out;
        }

        /**
         * POST/PUT suppliers — (1:1 db.saveSupplier : aucune validation, setDoc aveugle ;
         * l'id demande est cree s'il n'existe pas).
         */
        public static function save_supplier( array $body, ?string $biz_id = null ): array {
                global $wpdb;

                $legacy = $biz_id
                        ?: ( isset( $body['id'] ) && '' !== (string) $body['id'] ? (string) $body['id'] : self::uniq_legacy( 'sup-' ) );

                $row  = self::find_by_biz( Bebba_HF_DB::suppliers_table(), $legacy );
                $vals = array(
                        'name'                            => (string) ( $body['name'] ?? '' ),
                        'phone'                           => (string) ( $body['phone'] ?? '' ),
                        'email'                           => (string) ( $body['email'] ?? '' ),
                        'address'                         => (string) ( $body['address'] ?? '' ),
                        'supplied_ingredient_legacy_ids'  => isset( $body['suppliedIngredients'] ) && is_array( $body['suppliedIngredients'] )
                                ? wp_json_encode( array_values( $body['suppliedIngredients'] ) )
                                : null,
                );

                if ( $row ) {
                        self::update_row( Bebba_HF_DB::suppliers_table(), $vals, 'id = ' . (int) $row['id'] );
                } else {
                        $vals['legacy_id'] = $legacy;
                        self::insert_row( Bebba_HF_DB::suppliers_table(), $vals );
                }

                $after = self::find_by_biz( Bebba_HF_DB::suppliers_table(), $legacy );
                return self::format_supplier( $after ?: array() );
        }

        /** DELETE suppliers — inconditionnel (1:1 db.deleteSupplier) ; ingredients → supplier_id SET NULL par FK. */
        public static function delete_supplier( string $biz_id ): array {
                global $wpdb;
                $row = self::find_by_biz( Bebba_HF_DB::suppliers_table(), $biz_id );
                if ( $row ) {
                        $wpdb->delete( Bebba_HF_DB::suppliers_table(), array( 'id' => (int) $row['id'] ), array( '%d' ) );
                }
                return array( 'success' => true );
        }

        /* ----------------------------------------------------------- produits */

        /**
         * POST/PUT products — (1:1 db.saveProduct : validations nom/prix/categorie,
         * image par defaut Unsplash, relations baseIngredients + customization
         * reecrites integralement, comme le setDoc Firestore du document complet).
         */
        public static function save_product( array $body, ?string $biz_id = null ): array {
                global $wpdb;
                $p   = Bebba_HF_DB::products_table();
                $pi  = Bebba_HF_DB::product_ingredients_table();
                $po  = Bebba_HF_DB::product_options_table();
                $ps  = Bebba_HF_DB::product_supplements_table();

                $name = (string) ( $body['name'] ?? '' );
                if ( '' === trim( $name ) ) {
                        throw new Exception( 'Le nom du produit est obligatoire.' );
                }
                $base_price = $body['basePrice'] ?? null;
                if ( ! is_numeric( $base_price ) || is_string( $base_price ) || (float) $base_price < 0 ) {
                        throw new Exception( 'Le prix de base du produit doit être un nombre positif.' );
                }
                $category_id = (string) ( $body['categoryId'] ?? '' );
                if ( '' === $category_id ) {
                        throw new Exception( 'La catégorie du produit est obligatoire.' );
                }

                $legacy = $biz_id
                        ?: ( isset( $body['id'] ) && '' !== (string) $body['id'] ? (string) $body['id'] : self::uniq_legacy( 'prod-' ) );

                Bebba_HF_DB::begin();
                try {
                        $row = self::find_by_biz( $p, $legacy );
                        $cat = self::resolve_category( $category_id );

                        $sort_order = isset( $body['sortOrder'] ) && null !== $body['sortOrder']
                                ? (int) $body['sortOrder']
                                : ( isset( $body['order'] ) && null !== $body['order'] ? (int) $body['order'] : 10 );
                        $is_available = ( ( $body['available'] ?? null ) !== false ) && ( ( $body['isAvailable'] ?? null ) !== false );

                        $image     = (string) ( $body['image'] ?? '' );
                        $image_url = (string) ( $body['imageUrl'] ?? '' );

                        $vals = array(
                                'category_id'        => $cat ? (int) $cat['id'] : null,
                                'category_legacy_id' => $cat ? (string) $cat['legacy_id'] : $category_id,
                                'name'               => trim( $name ),
                                'description'        => (string) ( $body['description'] ?? '' ),
                                'base_price'         => self::dec2( self::round1( $base_price ) ),
                                'image_url'          => '' !== $image_url ? $image_url : ( '' !== $image ? $image : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80' ),
                                'image'              => '' !== $image_url ? $image_url : $image,
                                'calories'           => isset( $body['calories'] ) && null !== $body['calories'] ? (int) $body['calories'] : null,
                                'protein_grams'      => self::dec2( self::fl( $body['proteinGrams'] ?? null ) ),
                                'carbs_grams'        => self::dec2( self::fl( $body['carbsGrams'] ?? null ) ),
                                'fat_grams'          => self::dec2( self::fl( $body['fatGrams'] ?? null ) ),
                                'active'             => self::bool01( $body['active'] ?? null ),
                                'is_available'       => $is_available ? 1 : 0,
                                'available'          => $is_available ? 1 : 0,
                                'is_popular'         => ! empty( $body['isPopular'] ) ? 1 : 0,
                                'sort_order'         => $sort_order,
                                'legacy_order'       => $sort_order,
                        );

                        if ( $row ) {
                                self::update_row( $p, $vals, 'id = ' . (int) $row['id'] );
                                $pid = (int) $row['id'];
                        } else {
                                $vals['legacy_id'] = $legacy;
                                self::insert_row( $p, $vals );
                                $pid = (int) $wpdb->insert_id;
                        }

                        /* Relations : reecriture integrale (equivalent setDoc du document complet). */
                        $wpdb->query( $wpdb->prepare( "DELETE FROM {$pi} WHERE product_id = %d", $pid ) );
                        $wpdb->query( $wpdb->prepare( "DELETE FROM {$po} WHERE product_id = %d", $pid ) );
                        $wpdb->query( $wpdb->prepare( "DELETE FROM {$ps} WHERE product_id = %d", $pid ) );

                        $base_ingredients = $body['baseIngredients'] ?? array();
                        if ( is_array( $base_ingredients ) ) {
                                $pos = 0;
                                foreach ( $base_ingredients as $bi ) {
                                        if ( ! is_array( $bi ) ) {
                                                continue;
                                        }
                                        $biz_ing = (string) ( $bi['ingredientId'] ?? '' );
                                        $ing     = '' !== $biz_ing ? self::resolve_ingredient( $biz_ing ) : null;
                                        self::insert_row(
                                                $pi,
                                                array(
                                                        'product_id'               => $pid,
                                                        'ingredient_id'            => $ing ? (int) $ing['id'] : null,
                                                        'ingredient_legacy_id'     => $ing ? (string) $ing['legacy_id'] : $biz_ing,
                                                        'ingredient_name_snapshot' => $ing ? (string) $ing['name'] : (string) ( $bi['ingredientName'] ?? 'Ingrédient' ),
                                                        'position'                 => $pos,
                                                        'quantity'                 => self::dec2( self::fl( $bi['quantity'] ?? null ) ?? 0.0 ),
                                                        'unit'                     => $ing ? (string) $ing['unit'] : (string) ( $bi['unit'] ?? 'g' ),
                                                )
                                        );
                                        $pos++;
                                }
                        }

                        $custom = $body['customization'] ?? null;
                        if ( is_array( $custom ) ) {
                                foreach ( array( 'proteinOptions' => 'protein', 'veggiesOptions' => 'veggies', 'baseChoices' => 'base' ) as $key => $type ) {
                                        $list = $custom[ $key ] ?? array();
                                        if ( ! is_array( $list ) ) {
                                                continue;
                                        }
                                        $pos = 0;
                                        foreach ( $list as $opt ) {
                                                if ( ! is_array( $opt ) ) {
                                                        continue;
                                                }
                                                self::insert_row(
                                                        $po,
                                                        array(
                                                                'product_id'  => $pid,
                                                                'option_type' => $type,
                                                                'position'    => $pos,
                                                                'label'       => (string) ( $opt['label'] ?? 'Option' ),
                                                                'extra_price' => self::dec2( self::fl( $opt['extraPrice'] ?? null ) ?? 0.0 ),
                                                                'extra_grams' => 'base' === $type ? null : self::dec2( self::fl( $opt['extraGrams'] ?? null ) ),
                                                                'sort_order'  => $pos,
                                                                'is_default'  => ! empty( $opt['isDefault'] ) ? 1 : 0,
                                                        )
                                                );
                                                $pos++;
                                        }
                                }

                                $allowed = $custom['allowedSupplementIds'] ?? array();
                                if ( is_array( $allowed ) ) {
                                        $pos = 0;
                                        foreach ( $allowed as $sup_biz ) {
                                                $sup = self::resolve_supplement( (string) $sup_biz );
                                                self::insert_row(
                                                        $ps,
                                                        array(
                                                                'product_id'           => $pid,
                                                                'supplement_id'        => $sup ? (int) $sup['id'] : null,
                                                                'supplement_legacy_id' => $sup ? (string) $sup['legacy_id'] : (string) $sup_biz,
                                                                'sort_order'           => $pos,
                                                        )
                                                );
                                                $pos++;
                                        }
                                }
                        }

                        Bebba_HF_DB::commit();
                } catch ( Exception $e ) {
                        Bebba_HF_DB::rollback();
                        throw $e;
                }

                $full = Bebba_HF_Catalog::get_product_full( $legacy );
                if ( null === $full ) {
                        throw new Exception( 'Échec de relecture après enregistrement du produit.' );
                }
                return $full['product'];
        }

        /** DELETE products — inconditionnel (1:1 db.deleteProduct) + purge des relations. */
        public static function delete_product( string $biz_id ): array {
                global $wpdb;
                $p  = Bebba_HF_DB::products_table();
                $pi = Bebba_HF_DB::product_ingredients_table();
                $po = Bebba_HF_DB::product_options_table();
                $ps = Bebba_HF_DB::product_supplements_table();

                $row = self::find_by_biz( $p, $biz_id );
                if ( $row ) {
                        $pid = (int) $row['id'];
                        Bebba_HF_DB::begin();
                        try {
                                $wpdb->query( $wpdb->prepare( "DELETE FROM {$pi} WHERE product_id = %d", $pid ) );
                                $wpdb->query( $wpdb->prepare( "DELETE FROM {$po} WHERE product_id = %d", $pid ) );
                                $wpdb->query( $wpdb->prepare( "DELETE FROM {$ps} WHERE product_id = %d", $pid ) );
                                $wpdb->delete( $p, array( 'id' => $pid ), array( '%d' ) );
                                Bebba_HF_DB::commit();
                        } catch ( Exception $e ) {
                                Bebba_HF_DB::rollback();
                                throw $e;
                        }
                }
                return array( 'success' => true );
        }

        /* -------------------------------------------------------- supplements */

        /**
         * POST/PUT supplements — (1:1 db.saveSupplement : nom/prix obligatoires,
         * quantityConsumed = quantityConsumed ?? quantity ?? 100, unite de l'ingredient).
         */
        public static function save_supplement( array $body, ?string $biz_id = null ): array {
                $name = (string) ( $body['name'] ?? '' );
                if ( '' === trim( $name ) ) {
                        throw new Exception( 'Le nom du supplément est obligatoire.' );
                }
                $price = $body['price'] ?? null;
                if ( ! is_numeric( $price ) || is_string( $price ) || (float) $price < 0 ) {
                        throw new Exception( 'Le prix du supplément doit être un nombre positif.' );
                }

                $legacy = $biz_id
                        ?: ( isset( $body['id'] ) && '' !== (string) $body['id'] ? (string) $body['id'] : self::uniq_legacy( 'sup-' ) );

                $row = self::find_by_biz( Bebba_HF_DB::supplements_table(), $legacy );

                $ing = isset( $body['ingredientId'] ) && '' !== (string) $body['ingredientId']
                        ? self::resolve_ingredient( (string) $body['ingredientId'] )
                        : null;

                $quantity_consumed = isset( $body['quantityConsumed'] ) && null !== $body['quantityConsumed']
                        ? self::fl( $body['quantityConsumed'] )
                        : ( isset( $body['quantity'] ) && null !== $body['quantity'] ? self::fl( $body['quantity'] ) : 100.0 );

                $sort_order = isset( $body['sortOrder'] ) && null !== $body['sortOrder']
                        ? (int) $body['sortOrder']
                        : ( isset( $body['order'] ) && null !== $body['order'] ? (int) $body['order'] : 10 );

                $is_available = ( ( $body['available'] ?? null ) !== false ) && ( ( $body['isAvailable'] ?? null ) !== false );

                $vals = array(
                        'name'                     => trim( $name ),
                        'description'              => (string) ( $body['description'] ?? '' ),
                        'price'                    => self::dec2( self::round1( $price ) ),
                        'ingredient_id'            => $ing ? (int) $ing['id'] : null,
                        'ingredient_legacy_id'     => $ing ? (string) $ing['legacy_id'] : (string) ( $body['ingredientId'] ?? '' ),
                        'ingredient_name_snapshot' => $ing ? (string) $ing['name'] : (string) ( $body['ingredientName'] ?? 'Ingrédient' ),
                        'quantity_consumed'        => self::dec2( $quantity_consumed ?? 100.0 ),
                        'legacy_quantity'          => self::dec2( $quantity_consumed ),
                        'unit'                     => $ing ? (string) $ing['unit'] : (string) ( $body['unit'] ?? 'g' ),
                        'available'                => $is_available ? 1 : 0,
                        'is_available'             => $is_available ? 1 : 0,
                        'active'                   => self::bool01( $body['active'] ?? null ),
                        'sort_order'               => $sort_order,
                        'legacy_order'             => $sort_order,
                );

                if ( $row ) {
                        self::update_row( Bebba_HF_DB::supplements_table(), $vals, 'id = ' . (int) $row['id'] );
                } else {
                        $vals['legacy_id'] = $legacy;
                        self::insert_row( Bebba_HF_DB::supplements_table(), $vals );
                }

                $saved = Bebba_HF_Catalog::get_supplement( $legacy );
                if ( null === $saved ) {
                        throw new Exception( 'Échec de relecture après enregistrement du supplément.' );
                }
                return $saved;
        }

        /** DELETE supplements — inconditionnel (1:1 db.deleteSupplement). */
        public static function delete_supplement( string $biz_id ): array {
                global $wpdb;
                $row = self::find_by_biz( Bebba_HF_DB::supplements_table(), $biz_id );
                if ( $row ) {
                        $wpdb->delete( Bebba_HF_DB::supplements_table(), array( 'id' => (int) $row['id'] ), array( '%d' ) );
                }
                return array( 'success' => true );
        }

        /* -------------------------------------------------------- ingredients */

        /** GET /ingredients (admin + cuisine) — 1:1 db.getIngredients. */
        public static function list_ingredients(): array {
                global $wpdb;
                $t    = Bebba_HF_DB::ingredients_table();
                $rows = $wpdb->get_results( "SELECT * FROM {$t} ORDER BY id ASC", ARRAY_A );
                $out  = array();
                foreach ( ( $rows ?: array() ) as $r ) {
                        $out[] = self::format_ingredient( $r );
                }
                return $out;
        }

        /** POST/PUT ingredients — (1:1 db.saveIngredient : aucune validation, active absent → true). */
        public static function save_ingredient( array $body, ?string $biz_id = null ): array {
                $legacy = $biz_id
                        ?: ( isset( $body['id'] ) && '' !== (string) $body['id'] ? (string) $body['id'] : self::uniq_legacy( 'ing-' ) );

                $row = self::find_by_biz( Bebba_HF_DB::ingredients_table(), $legacy );

                $sup = isset( $body['supplierId'] ) && '' !== (string) $body['supplierId']
                        ? self::resolve_supplier( (string) $body['supplierId'] )
                        : null;

                $vals = array(
                        'name'                    => (string) ( $body['name'] ?? '' ),
                        'unit'                    => (string) ( $body['unit'] ?? 'g' ),
                        'stock_quantity'          => self::dec2( self::fl( $body['currentStock'] ?? null ) ),
                        'min_threshold'           => self::dec2( self::fl( $body['minThreshold'] ?? null ) ),
                        'purchase_cost'           => self::dec2( self::fl( $body['purchaseCost'] ?? null ) ),
                        'supplier_id'             => $sup ? (int) $sup['id'] : null,
                        'supplier_legacy_id'      => $sup ? (string) $sup['legacy_id'] : ( isset( $body['supplierId'] ) ? (string) $body['supplierId'] : null ),
                        'supplier_name_snapshot'  => $sup ? (string) $sup['name'] : ( isset( $body['supplierName'] ) ? (string) $body['supplierName'] : null ),
                        'category'                => isset( $body['category'] ) ? (string) $body['category'] : null,
                        'active'                  => null === ( $body['active'] ?? null ) ? 1 : self::bool01( $body['active'] ),
                );

                if ( $row ) {
                        self::update_row( Bebba_HF_DB::ingredients_table(), $vals, 'id = ' . (int) $row['id'] );
                } else {
                        $vals['legacy_id'] = $legacy;
                        self::insert_row( Bebba_HF_DB::ingredients_table(), $vals );
                }

                $after = self::find_by_biz( Bebba_HF_DB::ingredients_table(), $legacy );
                if ( null === $after ) {
                        throw new Exception( 'Échec de relecture après enregistrement de l’ingrédient.' );
                }
                return self::format_ingredient( $after );
        }

        /**
         * DELETE ingredients (admin seul) — 1:1 db.deleteIngredient : interdit si actif,
         * interdit si reference (recettes, supplements, commandes, mouvements).
         */
        public static function delete_ingredient( string $biz_id ): array {
                global $wpdb;
                $i  = Bebba_HF_DB::ingredients_table();
                $pi = Bebba_HF_DB::product_ingredients_table();
                $p  = Bebba_HF_DB::products_table();
                $s  = Bebba_HF_DB::supplements_table();
                $oi = Bebba_HF_DB::order_items_table();
                $pp = Bebba_HF_DB::order_item_prep_table();
                $o  = Bebba_HF_DB::orders_table();
                $sm = Bebba_HF_DB::stock_movements_table();

                $row = self::find_by_biz( $i, $biz_id );
                if ( ! $row ) {
                        throw new Exception( 'Ingrédient introuvable.' );
                }
                if ( (int) $row['active'] !== 0 ) {
                        throw new Exception( "Impossible de supprimer un ingrédient actif. Veuillez d'abord le désactiver." );
                }

                $id_int = (int) $row['id'];
                $leg    = (string) $row['legacy_id'];

                $prod_rows = $wpdb->get_results(
                        $wpdb->prepare(
                                "SELECT DISTINCT p.name FROM {$p} p JOIN {$pi} pi ON pi.product_id = p.id
                                 WHERE pi.ingredient_legacy_id = %s OR pi.ingredient_id = %d",
                                $leg,
                                $id_int
                        ),
                        ARRAY_A
                );
                $sup_rows = $wpdb->get_results(
                        $wpdb->prepare( "SELECT name FROM {$s} WHERE ingredient_legacy_id = %s OR ingredient_id = %d", $leg, $id_int ),
                        ARRAY_A
                );
                $ord_rows = $wpdb->get_results(
                        $wpdb->prepare(
                                "SELECT DISTINCT o.order_number FROM {$o} o
                                 JOIN {$oi} oi ON oi.order_id = o.id
                                 JOIN {$pp} pp ON pp.order_item_id = oi.id
                                 WHERE pp.ingredient_legacy_id = %s OR pp.ingredient_id = %d",
                                $leg,
                                $id_int
                        ),
                        ARRAY_A
                );
                $has_movements = self::count_of( $wpdb->prepare( "SELECT COUNT(*) FROM {$sm} WHERE ingredient_legacy_id = %s OR ingredient_id = %d", $leg, $id_int ) ) > 0;

                $products    = $prod_rows ? wp_list_pluck( $prod_rows, 'name' ) : array();
                $supplements = $sup_rows ? wp_list_pluck( $sup_rows, 'name' ) : array();
                $orders      = $ord_rows ? wp_list_pluck( $ord_rows, 'order_number' ) : array();

                if ( $products || $supplements || $orders || $has_movements ) {
                        $reasons = array();
                        if ( $products ) {
                                $reasons[] = 'recettes (' . implode( ', ', $products ) . ')';
                        }
                        if ( $supplements ) {
                                $reasons[] = 'suppléments (' . implode( ', ', $supplements ) . ')';
                        }
                        if ( $orders ) {
                                $reasons[] = 'commandes (#' . implode( ', #', array_slice( $orders, 0, 3 ) ) . ')';
                        }
                        if ( $has_movements ) {
                                $reasons[] = 'historique des mouvements de stock';
                        }
                        throw new Exception( 'Impossible de supprimer définitivement cet ingrédient car il est référencé (' . implode( ' ; ', $reasons ) . '). Veuillez le désactiver à la place.' );
                }

                $wpdb->delete( $i, array( 'id' => $id_int ), array( '%d' ) );
                return array( 'success' => true );
        }

        /**
         * POST /ingredients/:id/stock — ajustement manuel (1:1 db.addStockMovement) :
         * transaction, arrondi 0.1, mouvement signe avec performer "Nom (Admin|Cuisine)".
         */
        public static function adjust_stock( string $biz_id, array $body, array $user ): array {
                global $wpdb;
                $i  = Bebba_HF_DB::ingredients_table();
                $sm = Bebba_HF_DB::stock_movements_table();

                $quantity = $body['quantity'] ?? null;
                if ( ! is_numeric( $quantity ) || is_bool( $quantity ) ) {
                        throw new Exception( 'Quantité invalide.' );
                }
                $quantity = (float) $quantity;

                $type = (string) ( $body['type'] ?? 'manual_in' );
                if ( '' === $type ) {
                        $type = 'manual_in';
                }
                if ( ! in_array( $type, self::MOVEMENT_TYPES, true ) ) {
                        throw new Exception( 'Type de mouvement de stock invalide.' ); // Adaptation : ENUM MySQL strict (documentee dans REPORT_LOT_4.md).
                }
                $notes = (string) ( $body['notes'] ?? '' );
                if ( '' === $notes ) {
                        $notes = 'Ajustement manuel de stock';
                }
                $performed_by = (string) ( $user['name'] ?? 'Administrateur' ) . ' (' . ( ( $user['role'] ?? '' ) === 'admin' ? 'Admin' : 'Cuisine' ) . ')';

                Bebba_HF_DB::begin();
                try {
                        $row = self::find_by_biz( $i, $biz_id );
                        if ( ! $row ) {
                                throw new Exception( 'Ingrédient #' . $biz_id . ' introuvable.' );
                        }

                        $new_stock = self::round1( ( self::fl( $row['stock_quantity'] ) ?? 0.0 ) + $quantity );
                        $now       = Bebba_HF_DB::now();

                        $wpdb->query(
                                $wpdb->prepare( "UPDATE {$i} SET stock_quantity = %s WHERE id = %d", self::dec2( $new_stock ), (int) $row['id'] )
                        );

                        $legacy_mov = self::uniq_legacy( 'mov-', true );
                        self::insert_row(
                                $sm,
                                array(
                                        'legacy_id'                => $legacy_mov,
                                        'ingredient_id'            => (int) $row['id'],
                                        'ingredient_legacy_id'     => (string) $row['legacy_id'],
                                        'ingredient_name_snapshot' => (string) $row['name'],
                                        'movement_type'            => $type,
                                        'quantity'                 => $quantity,
                                        'unit'                     => (string) ( $row['unit'] ?? 'g' ),
                                        'order_id'                 => null,
                                        'order_legacy_id'          => null,
                                        'order_number_snapshot'    => null,
                                        'notes'                    => $notes,
                                        'performed_by'             => $performed_by,
                                        'timestamp'                => $now,
                                )
                        );

                        Bebba_HF_DB::commit();
                } catch ( Exception $e ) {
                        Bebba_HF_DB::rollback();
                        throw $e;
                }

                $after   = self::find_by_biz( $i, $biz_id );
                $mov_row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$sm} WHERE legacy_id = %s", $legacy_mov ), ARRAY_A );
                return array(
                        'ingredient' => $after ? self::format_ingredient( $after ) : null,
                        'movement'   => $mov_row ? self::format_movement( $mov_row ) : null,
                );
        }

        /** GET /stock-movements (admin + admin_readonly) — trie du plus recent au plus ancien. */
        public static function list_stock_movements(): array {
                global $wpdb;
                $sm   = Bebba_HF_DB::stock_movements_table();
                $rows = $wpdb->get_results( "SELECT * FROM {$sm} ORDER BY timestamp DESC, id DESC", ARRAY_A );
                $out  = array();
                foreach ( ( $rows ?: array() ) as $r ) {
                        $out[] = self::format_movement( $r );
                }
                return $out;
        }

        /* ------------------------------------------------------------ livreurs */

        /** GET /drivers (admin + cuisine) — 1:1 db.getDrivers (username via jointure bebba_users). */
        public static function list_drivers(): array {
                global $wpdb;
                $d = Bebba_HF_DB::drivers_table();
                $u = Bebba_HF_DB::users_table();
                $rows = $wpdb->get_results( "SELECT d.*, u.username AS usr_username FROM {$d} d LEFT JOIN {$u} u ON u.driver_id = d.id ORDER BY d.id ASC", ARRAY_A );
                $out  = array();
                foreach ( ( $rows ?: array() ) as $r ) {
                        $out[] = self::format_driver( $r, '' !== (string) ( $r['usr_username'] ?? '' ) ? (string) $r['usr_username'] : null );
                }
                return $out;
        }

        /**
         * POST /drivers (admin) — 1:1 server.ts + db.createDriverWithAccount :
         * validations exactes, unicite username, creation ATOMIQUE livreur + compte driver.
         */
        public static function create_driver( array $body ): array {
                global $wpdb;
                $u = Bebba_HF_DB::users_table();
                $d = Bebba_HF_DB::drivers_table();

                $name     = isset( $body['name'] ) && is_string( $body['name'] ) ? $body['name'] : '';
                $phone    = isset( $body['phone'] ) && is_string( $body['phone'] ) ? $body['phone'] : '';
                $username = isset( $body['username'] ) && is_string( $body['username'] ) ? $body['username'] : '';
                $password = isset( $body['password'] ) && is_string( $body['password'] ) ? $body['password'] : '';

                if ( '' === trim( $name ) ) {
                        throw new Exception( 'Le nom du livreur est obligatoire.' );
                }
                if ( '' === trim( $phone ) ) {
                        throw new Exception( 'Le numéro de téléphone du livreur est obligatoire.' );
                }
                if ( '' === trim( $username ) ) {
                        throw new Exception( 'Le nom d’utilisateur (identifiant) est obligatoire.' );
                }
                if ( strlen( $password ) < 4 ) {
                        throw new Exception( 'Le mot de passe doit comporter au moins 4 caractères.' );
                }

                $clean_username = trim( strtolower( $username ) );
                if ( self::count_of( $wpdb->prepare( "SELECT COUNT(*) FROM {$u} WHERE username = %s", $clean_username ) ) > 0 ) {
                        throw new Exception( 'Le nom d’utilisateur "' . $clean_username . '" est déjà attribué.' );
                }

                $is_active = ( $body['active'] ?? null ) !== false;

                Bebba_HF_DB::begin();
                try {
                        $legacy_drv = self::uniq_legacy( 'drv-', true );
                        self::insert_row(
                                $d,
                                array(
                                        'legacy_id'        => $legacy_drv,
                                        'name'             => trim( $name ),
                                        'phone'            => trim( $phone ),
                                        'vehicle'          => trim( (string) ( $body['vehicle'] ?? '' ) !== '' ? (string) $body['vehicle'] : 'Scooter standard' ),
                                        'active'           => $is_active ? 1 : 0,
                                        'total_deliveries' => 0,
                                        'rating'           => 5.0,
                                )
                        );
                        $driver_id = (int) $wpdb->insert_id;

                        self::insert_row(
                                $u,
                                array(
                                        'legacy_id'            => null,
                                        'username'             => $clean_username,
                                        'phone'                => trim( $phone ),
                                        'name'                 => trim( $name ),
                                        'password_hash'        => Bebba_HF_Auth::hash_password( $password ),
                                        'role'                 => 'driver',
                                        'driver_id'            => $driver_id,
                                        'active'               => $is_active ? 1 : 0,
                                        'token_version'        => 0,
                                        'must_change_password' => 0,
                                )
                        );
                        $user_id = (int) $wpdb->insert_id;

                        Bebba_HF_DB::commit();
                } catch ( Exception $e ) {
                        Bebba_HF_DB::rollback();
                        throw $e;
                }

                $drow = self::find_by_biz( $d, $legacy_drv );
                $urow = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$u} WHERE id = %d", $user_id ), ARRAY_A );
                return array(
                        'driver' => $drow ? self::format_driver( $drow, $clean_username ) : null,
                        'user'   => $urow ? Bebba_HF_Auth::safe_user( $urow ) : null,
                );
        }

        /** PUT /drivers/:id (admin) — 1:1 db.updateDriverWithAccount : profil metier + sync du compte lie. */
        public static function update_driver( string $biz_id, array $body ): array {
                global $wpdb;
                $d = Bebba_HF_DB::drivers_table();
                $u = Bebba_HF_DB::users_table();

                $driver = self::resolve_driver( $biz_id );
                if ( ! $driver ) {
                        throw new Exception( 'Livreur #' . $biz_id . ' introuvable.' );
                }
                $driver_id = (int) $driver['id'];

                Bebba_HF_DB::begin();
                try {
                        $drv_vals = array();
                        if ( isset( $body['name'] ) && '' !== trim( (string) $body['name'] ) ) {
                                $drv_vals['name'] = trim( (string) $body['name'] );
                        }
                        if ( isset( $body['phone'] ) && '' !== trim( (string) $body['phone'] ) ) {
                                $drv_vals['phone'] = trim( (string) $body['phone'] );
                        }
                        if ( isset( $body['vehicle'] ) && '' !== trim( (string) $body['vehicle'] ) ) {
                                $drv_vals['vehicle'] = trim( (string) $body['vehicle'] );
                        }
                        if ( $drv_vals ) {
                                self::update_row( $d, $drv_vals, 'id = ' . $driver_id );
                        }

                        $linked = self::user_of_driver( $driver_id );
                        if ( $linked ) {
                                $usr_vals = array();
                                if ( isset( $body['name'] ) && '' !== trim( (string) $body['name'] ) ) {
                                        $usr_vals['name'] = trim( (string) $body['name'] );
                                }
                                if ( isset( $body['phone'] ) && '' !== trim( (string) $body['phone'] ) ) {
                                        $usr_vals['phone'] = trim( (string) $body['phone'] );
                                }
                                if ( $usr_vals ) {
                                        self::update_row( $u, $usr_vals, 'id = ' . (int) $linked['id'] );
                                }
                        }
                        Bebba_HF_DB::commit();
                } catch ( Exception $e ) {
                        Bebba_HF_DB::rollback();
                        throw $e;
                }

                $after   = self::find_by_biz( $d, $biz_id );
                $linked2 = self::user_of_driver( $driver_id );
                return self::format_driver( $after ?: array(), $linked2 ? (string) $linked2['username'] : null );
        }

        /** PATCH /drivers/:id/status (admin) — 1:1 db.setDriverActiveStatus : toggle synchronise driver + compte. */
        public static function set_driver_status( string $biz_id, array $body ): array {
                global $wpdb;
                $d = Bebba_HF_DB::drivers_table();
                $u = Bebba_HF_DB::users_table();

                $active = $body['active'] ?? null;
                if ( ! is_bool( $active ) ) {
                        throw new Exception( 'Le champ active (booléen) est requis.' );
                }
                $driver = self::resolve_driver( $biz_id );
                if ( ! $driver ) {
                        throw new Exception( 'Livreur #' . $biz_id . ' introuvable.' );
                }
                $driver_id = (int) $driver['id'];

                Bebba_HF_DB::begin();
                try {
                        self::update_row( $d, array( 'active' => $active ? 1 : 0 ), 'id = ' . $driver_id );
                        $wpdb->query( $wpdb->prepare( "UPDATE {$u} SET active = %d WHERE driver_id = %d", $active ? 1 : 0, $driver_id ) );
                        Bebba_HF_DB::commit();
                } catch ( Exception $e ) {
                        Bebba_HF_DB::rollback();
                        throw $e;
                }

                $after   = self::find_by_biz( $d, $biz_id );
                $linked  = self::user_of_driver( $driver_id );
                return array(
                        'success' => true,
                        'driver'  => self::format_driver( $after ?: array(), $linked ? (string) $linked['username'] : null ),
                );
        }

        /**
         * PATCH /drivers/:id/password (admin) — 1:1 db.resetDriverPassword.
         * Plus la revocation plugin : token_version incremente (les anciens JWT meurent).
         */
        public static function reset_driver_password( string $biz_id, array $body ): array {
                global $wpdb;
                $u = Bebba_HF_DB::users_table();
                $d = Bebba_HF_DB::drivers_table();

                $new_password = isset( $body['newPassword'] ) && is_string( $body['newPassword'] ) ? $body['newPassword'] : '';
                if ( '' === $new_password || strlen( $new_password ) < 4 ) {
                        throw new Exception( 'Le nouveau mot de passe doit comporter au moins 4 caractères.' );
                }

                $driver = self::resolve_driver( $biz_id );
                if ( ! $driver ) {
                        throw new Exception( 'Livreur #' . $biz_id . ' introuvable.' );
                }
                $linked = self::user_of_driver( (int) $driver['id'] );
                if ( ! $linked ) {
                        throw new Exception( 'Compte utilisateur introuvable pour le livreur #' . $biz_id . '.' );
                }

                self::update_row(
                        $u,
                        array(
                                'password_hash' => Bebba_HF_Auth::hash_password( $new_password ),
                                'token_version' => (int) $linked['token_version'] + 1,
                        ),
                        'id = ' . (int) $linked['id']
                );

                return array(
                        'success' => true,
                        'message' => 'Mot de passe réinitialisé avec succès.',
                );
        }

        /** DELETE /drivers/:id (admin) — 1:1 db.deleteDriver : protection historique commandes, suppression driver + compte. */
        public static function delete_driver( string $biz_id ): array {
                global $wpdb;
                $d = Bebba_HF_DB::drivers_table();
                $u = Bebba_HF_DB::users_table();
                $o = Bebba_HF_DB::orders_table();

                $driver = self::resolve_driver( $biz_id );
                if ( ! $driver ) {
                        throw new Exception( 'Livreur #' . $biz_id . ' introuvable.' );
                }
                $driver_id = (int) $driver['id'];

                $orders = self::count_of( $wpdb->prepare( "SELECT COUNT(*) FROM {$o} WHERE driver_id = %d", $driver_id ) );
                if ( $orders > 0 ) {
                        throw new Exception( 'Impossible de supprimer définitivement le livreur "' . $driver['name'] . '" car des commandes historiques lui sont associées. Veuillez le désactiver.' );
                }

                Bebba_HF_DB::begin();
                try {
                        $wpdb->query( $wpdb->prepare( "DELETE FROM {$u} WHERE driver_id = %d", $driver_id ) );
                        $wpdb->delete( $d, array( 'id' => $driver_id ), array( '%d' ) );
                        Bebba_HF_DB::commit();
                } catch ( Exception $e ) {
                        Bebba_HF_DB::rollback();
                        throw $e;
                }
                return array( 'success' => true );
        }

        /* --------------------------------------------------------- utilisateurs */

        /** GET /users (admin) — liste complete sans hash (safe_user). */
        public static function list_users(): array {
                global $wpdb;
                $u    = Bebba_HF_DB::users_table();
                $rows = $wpdb->get_results( "SELECT * FROM {$u} ORDER BY id ASC", ARRAY_A );
                $out  = array();
                foreach ( ( $rows ?: array() ) as $r ) {
                        $out[] = Bebba_HF_Auth::safe_user( $r );
                }
                return $out;
        }

        /**
         * POST /users (admin) — 1:1 server.ts : roles driver/client refuses (canaux dedies),
         * unicite username normalisee, hash bcrypt cost 10. Adaptation : role hors ENUM refuse.
         */
        public static function create_user( array $body ): array {
                global $wpdb;
                $u = Bebba_HF_DB::users_table();

                $username = (string) ( $body['username'] ?? '' );
                $password = (string) ( $body['password'] ?? '' );
                $role     = (string) ( $body['role'] ?? '' );

                if ( '' === $username || '' === $password || '' === $role ) {
                        throw new Exception( 'Champs obligatoires manquants.' );
                }
                if ( 'driver' === $role ) {
                        throw new Exception( 'Les comptes livreurs doivent être créés via la gestion des livreurs.' );
                }
                if ( 'client' === $role ) {
                        throw new Exception( 'Les comptes clients doivent être créés via l’inscription client (/api/auth/register-client).' );
                }
                if ( ! in_array( $role, Bebba_HF_Auth::ROLES, true ) ) {
                        throw new Exception( 'Rôle invalide.' ); // Adaptation : ENUM MySQL strict (documentee dans REPORT_LOT_4.md).
                }

                $clean_username = trim( strtolower( $username ) );
                if ( self::count_of( $wpdb->prepare( "SELECT COUNT(*) FROM {$u} WHERE username = %s", $clean_username ) ) > 0 ) {
                        throw new Exception( 'Ce nom d’utilisateur est déjà utilisé.' );
                }

                self::insert_row(
                        $u,
                        array(
                                'legacy_id'            => null,
                                'username'             => $clean_username,
                                // phone est UNIQUE en MySQL (uk_bebba_users_phone) : un staff sans
                                // telephone doit rester NULL (colonne nullable, NULL multiples
                                // autorises). Un '' flaggerait un doublon des le 2e compte cree
                                // sans phone (fix LOT 4 v0.4.2 ; Express/Firestore sans contrainte).
                                'phone'                => isset( $body['phone'] ) && '' !== trim( (string) $body['phone'] ) ? (string) $body['phone'] : null,
                                'name'                 => isset( $body['name'] ) && '' !== (string) $body['name'] ? (string) $body['name'] : $clean_username,
                                'password_hash'        => Bebba_HF_Auth::hash_password( $password ),
                                'role'                 => $role,
                                'driver_id'            => null,
                                'active'               => self::bool01( $body['active'] ?? null ),
                                'token_version'        => 0,
                                'must_change_password' => 0,
                        )
                );

                $row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$u} WHERE username = %s LIMIT 1", $clean_username ), ARRAY_A );
                if ( ! $row ) {
                        throw new Exception( 'Échec de relecture après création du compte.' );
                }
                return Bebba_HF_Auth::safe_user( $row );
        }

        /* --------------------------------------------------------------- stats */

        /** GET /stats (admin + admin_readonly) — 1:1 db.getDashboardStats (jour = UTC, comme toISOString). */
        public static function dashboard_stats(): array {
                global $wpdb;
                $o = Bebba_HF_DB::orders_table();
                $i = Bebba_HF_DB::ingredients_table();
                $oi = Bebba_HF_DB::order_items_table();

                $today = gmdate( 'Y-m-d' );

                $status_counts = array(
                        'received'           => 0,
                        'preparing'          => 0,
                        'ready'              => 0,
                        'waiting_for_driver' => 0,
                        'delivering'         => 0,
                        'delivered'          => 0,
                        'cancelled'          => 0,
                );
                foreach ( $wpdb->get_results( "SELECT status, COUNT(*) AS c FROM {$o} GROUP BY status", ARRAY_A ) ?: array() as $r ) {
                        if ( isset( $status_counts[ $r['status'] ] ) ) {
                                $status_counts[ $r['status'] ] = (int) $r['c'];
                        }
                }

                $today_orders = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$o} WHERE DATE(placed_at) = %s", $today ) );
                $today_revenue = self::round1( $wpdb->get_var( $wpdb->prepare( "SELECT SUM(total_amount) FROM {$o} WHERE DATE(placed_at) = %s AND status <> 'cancelled'", $today ) ) );
                $collected = self::round1( $wpdb->get_var( "SELECT SUM(total_amount) FROM {$o} WHERE payment_status = 'paid'" ) );
                $pending   = self::round1( $wpdb->get_var( "SELECT SUM(total_amount) FROM {$o} WHERE payment_status <> 'paid' AND status <> 'cancelled'" ) );

                $low_stock = self::count_of( "SELECT COUNT(*) FROM {$i} WHERE stock_quantity <= min_threshold" );

                $top = array();
                $rows = $wpdb->get_results(
                        "SELECT oi.product_name_snapshot AS name, SUM(oi.quantity) AS cnt, SUM(oi.item_total_price) AS total_dt
                         FROM {$oi} oi JOIN {$o} o ON o.id = oi.order_id
                         WHERE o.status <> 'cancelled'
                         GROUP BY oi.product_legacy_id, oi.product_id, oi.product_name_snapshot
                         ORDER BY cnt DESC LIMIT 5",
                        ARRAY_A
                );
                foreach ( ( $rows ?: array() ) as $r ) {
                        $top[] = array(
                                'name'    => $r['name'],
                                'count'   => (int) $r['cnt'],
                                'totalDT' => self::fl( $r['total_dt'] ) ?? 0.0,
                        );
                }

                return array(
                        'todayOrdersCount'     => $today_orders,
                        'todayRevenue'         => $today_revenue,
                        'statusCounts'         => $status_counts,
                        'totalCollectedCash'   => $collected,
                        'pendingCashToCollect' => $pending,
                        'lowStockCount'        => $low_stock,
                        'topSellingProducts'   => $top,
                );
        }

        /* ------------------------------------------------------ reset demo data */

        /**
         * POST /reset-demo-data (admin) — portage adapte de db.resetDemoData :
         * purge les commandes/mouvements/cles d'idempotence/clients/livreurs, restaure
         * les stocks de la seed LOT 2 et le compteur a 1100, PRESERVE le catalogue
         * et les comptes staff. Verifications defensives avant toute suppression.
         */
        public static function reset_demo_data(): array {
                global $wpdb;
                $o    = Bebba_HF_DB::orders_table();
                $oi   = Bebba_HF_DB::order_items_table();
                $os   = Bebba_HF_DB::order_item_supplements_table();
                $pp   = Bebba_HF_DB::order_item_prep_table();
                $sh   = Bebba_HF_DB::order_status_history_table();
                $sm   = Bebba_HF_DB::stock_movements_table();
                $ide  = Bebba_HF_DB::order_idempotency_table();
                $u    = Bebba_HF_DB::users_table();
                $d    = Bebba_HF_DB::drivers_table();
                $c    = Bebba_HF_DB::categories_table();
                $p    = Bebba_HF_DB::products_table();
                $s    = Bebba_HF_DB::supplements_table();
                $sup  = Bebba_HF_DB::suppliers_table();
                $i    = Bebba_HF_DB::ingredients_table();
                $cnt  = Bebba_HF_DB::counters_table();

                /* 1. Verifications defensives (equivalent "Interruption defensive"). */
                if ( self::count_of( "SELECT COUNT(*) FROM {$c}" ) === 0 || self::count_of( "SELECT COUNT(*) FROM {$p}" ) === 0 ) {
                        throw new Exception( 'Interruption défensive : catalogue manquant ou vide.' );
                }
                if ( self::count_of( "SELECT COUNT(*) FROM {$u} WHERE role = 'admin'" ) === 0 ) {
                        throw new Exception( 'Interruption défensive : compte staff critique manquant.' );
                }

                $counts = array(
                        'orders'               => self::count_of( "SELECT COUNT(*) FROM {$o}" ),
                        'stockMovements'       => self::count_of( "SELECT COUNT(*) FROM {$sm}" ),
                        'users'                => self::count_of( "SELECT COUNT(*) FROM {$u} WHERE role = 'client' OR driver_id IS NOT NULL" ),
                        'drivers'              => self::count_of( "SELECT COUNT(*) FROM {$d}" ),
                        'ingredients'          => 0,
                        'orderIdempotencyKeys' => self::count_of( "SELECT COUNT(*) FROM {$ide}" ),
                        'clientPhoneIndex'     => 0, // Index telephone Firestore : non applicable en MySQL.
                );

                Bebba_HF_DB::begin();
                try {
                        /* 2. Purge (enfants d'abord). */
                        $wpdb->query( "DELETE FROM {$os}" );
                        $wpdb->query( "DELETE FROM {$pp}" );
                        $wpdb->query( "DELETE FROM {$sh}" );
                        $wpdb->query( "DELETE FROM {$oi}" );
                        $wpdb->query( "DELETE FROM {$ide}" );
                        $wpdb->query( "DELETE FROM {$sm}" );
                        $wpdb->query( "DELETE FROM {$o}" );

                        /* 3. Comptes de demonstration : clients + comptes livreurs lies (staff preserve). */
                        $wpdb->query( "DELETE FROM {$u} WHERE role = 'client' OR driver_id IS NOT NULL" );
                        $wpdb->query( "DELETE FROM {$d}" );

                        /* 4. Restauration des stocks de la seed LOT 2 (equivalent des 17 ingredients officiels). */
                        $wpdb->query(
                                "UPDATE {$i} SET stock_quantity = CASE legacy_id
                                        WHEN 'ing-poulet' THEN 8000.00
                                        WHEN 'ing-legumes' THEN 12000.00
                                        WHEN 'ing-riz' THEN 6000.00
                                        WHEN 'ing-quinoa' THEN 3000.00
                                        WHEN 'ing-sauce-yaourt' THEN 2500.00
                                        ELSE stock_quantity END
                                 WHERE legacy_id IN ('ing-poulet','ing-legumes','ing-riz','ing-quinoa','ing-sauce-yaourt')"
                        );

                        /* 5. Compteur commandes revient a 1100 (prochaine commande = BEBBA-1101). */
                        if ( self::count_of( $wpdb->prepare( "SELECT COUNT(*) FROM {$cnt} WHERE counter_name = %s", 'orders' ) ) > 0 ) {
                                $wpdb->query( $wpdb->prepare( "UPDATE {$cnt} SET current_value = %d WHERE counter_name = %s", 1100, 'orders' ) );
                        } else {
                                self::insert_row( $cnt, array( 'counter_name' => 'orders', 'current_value' => 1100 ) );
                        }

                        Bebba_HF_DB::commit();
                } catch ( Exception $e ) {
                        Bebba_HF_DB::rollback();
                        throw $e;
                }

                return array(
                        'success'       => true,
                        'deletedCounts' => $counts,
                        'preservedCounts' => array(
                                'staffUsers'  => self::count_of( "SELECT COUNT(*) FROM {$u} WHERE role <> 'client'" ),
                                'drivers'     => self::count_of( "SELECT COUNT(*) FROM {$d}" ),
                                'categories'  => self::count_of( "SELECT COUNT(*) FROM {$c}" ),
                                'products'    => self::count_of( "SELECT COUNT(*) FROM {$p}" ),
                                'supplements' => self::count_of( "SELECT COUNT(*) FROM {$s}" ),
                                'suppliers'   => self::count_of( "SELECT COUNT(*) FROM {$sup}" ),
                                'ingredients' => self::count_of( "SELECT COUNT(*) FROM {$i}" ),
                        ),
                        'nextOrderSeq'     => 1101,
                        'limitationNotice' => 'Adaptation WordPress : restauration des stocks limitée aux 5 ingrédients de la seed LOT 2 ; aucun ingrédient supprimé ; index téléphone Firestore non applicable.',
                );
        }
}
