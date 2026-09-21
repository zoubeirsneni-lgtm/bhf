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
	$wpdb->prefix . 'bebba_counters',
);

foreach ( $tables as $table ) {
	$wpdb->query( $wpdb->prepare( 'DROP TABLE IF EXISTS %i', $table ) );
}

delete_option( 'bebba_hf_jwt_secret' );
delete_option( 'bebba_hf_schema_version' );
delete_option( 'bebba_hf_keep_data' );
