<?php
/**
 * Desinstallation : purge des tables et options bebba.
 * Reglage "bebba_hf_keep_data" = 'yes' => conservation des donnees metier.
 * PHASE 0 : etendre la purge aux 17 autres tables bebba_* a mesure qu'elles sont portees.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

global $wpdb;

$keep = get_option( 'bebba_hf_keep_data', 'no' );

// Notice admin semee : toujours supprimee (secret ephemere).
delete_option( 'bebba_hf_seed_notice' );

if ( 'yes' === $keep ) {
	return;
}

$tables = array(
	$wpdb->prefix . 'bebba_users',
	$wpdb->prefix . 'bebba_categories',
	$wpdb->prefix . 'bebba_suppliers',
	$wpdb->prefix . 'bebba_ingredients',
	$wpdb->prefix . 'bebba_supplements',
	$wpdb->prefix . 'bebba_drivers',
	$wpdb->prefix . 'bebba_products',
	$wpdb->prefix . 'bebba_product_ingredients',
	$wpdb->prefix . 'bebba_product_options',
	$wpdb->prefix . 'bebba_product_supplements',
	$wpdb->prefix . 'bebba_orders',
	$wpdb->prefix . 'bebba_order_items',
	$wpdb->prefix . 'bebba_order_item_supplements',
	$wpdb->prefix . 'bebba_order_item_prep',
	$wpdb->prefix . 'bebba_order_status_history',
	$wpdb->prefix . 'bebba_stock_movements',
	$wpdb->prefix . 'bebba_counters',
	$wpdb->prefix . 'bebba_order_idempotency',
	$wpdb->prefix . 'bebba_migration_map',
	$wpdb->prefix . 'bebba_migration_quarantine',
);

foreach ( $tables as $table ) {
	$wpdb->query( $wpdb->prepare( 'DROP TABLE IF EXISTS %i', $table ) );
}

delete_option( 'bebba_hf_jwt_secret' );
delete_option( 'bebba_hf_schema_version' );
delete_option( 'bebba_hf_keep_data' );
