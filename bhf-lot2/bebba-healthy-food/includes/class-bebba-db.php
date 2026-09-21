<?php
/**
 * Couche d'acces aux donnees bebba.
 * Contrat de relecture : toute requete parametree passe par $wpdb->prepare().
 * Les montants sont des chaines DECIMAL renvoyees par MySQL — caster cote PHP uniquement pour l'affichage.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bebba_HF_DB {

	public static function table( string $name ): string {
		global $wpdb;
		return $wpdb->prefix . 'bebba_' . $name;
	}

	public static function users_table(): string {
		return self::table( 'users' );
	}

	public static function counters_table(): string {
		return self::table( 'counters' );
	}

	public static function categories_table(): string {
		return self::table( 'categories' );
	}

	public static function suppliers_table(): string {
		return self::table( 'suppliers' );
	}

	public static function ingredients_table(): string {
		return self::table( 'ingredients' );
	}

	public static function supplements_table(): string {
		return self::table( 'supplements' );
	}

	public static function drivers_table(): string {
		return self::table( 'drivers' );
	}

	public static function products_table(): string {
		return self::table( 'products' );
	}

	public static function product_ingredients_table(): string {
		return self::table( 'product_ingredients' );
	}

	public static function product_options_table(): string {
		return self::table( 'product_options' );
	}

	public static function product_supplements_table(): string {
		return self::table( 'product_supplements' );
	}

	public static function orders_table(): string {
		return self::table( 'orders' );
	}

	public static function order_items_table(): string {
		return self::table( 'order_items' );
	}

	public static function order_item_supplements_table(): string {
		return self::table( 'order_item_supplements' );
	}

	public static function order_item_prep_table(): string {
		return self::table( 'order_item_prep' );
	}

	public static function order_status_history_table(): string {
		return self::table( 'order_status_history' );
	}

	public static function stock_movements_table(): string {
		return self::table( 'stock_movements' );
	}

	public static function order_idempotency_table(): string {
		return self::table( 'order_idempotency' );
	}

	public static function migration_map_table(): string {
		return self::table( 'migration_map' );
	}

	public static function migration_quarantine_table(): string {
		return self::table( 'migration_quarantine' );
	}

	/** Transactions — a utiliser pour toute ecriture multi-tables. */
	public static function begin(): void {
		global $wpdb;
		$wpdb->query( 'START TRANSACTION' );
	}

	public static function commit(): void {
		global $wpdb;
		$wpdb->query( 'COMMIT' );
	}

	public static function rollback(): void {
		global $wpdb;
		$wpdb->query( 'ROLLBACK' );
	}

	/**
	 * Reseve un numero sequentiel (remplace les IDs Date.now()).
	 * A appeler DANS une transaction : SELECT ... FOR UPDATE verrouille la ligne.
	 */
	public static function next_counter( string $name ): int {
		global $wpdb;
		$table = self::counters_table();

		// Creation paresseuse du compteur (si absente de la transaction courante).
		$wpdb->query(
			$wpdb->prepare(
				"INSERT INTO {$table} (counter_name, current_value) VALUES (%s, 0)
				 ON DUPLICATE KEY UPDATE counter_name = VALUES(counter_name)",
				$name
			)
		);

		$wpdb->query( $wpdb->prepare( "SELECT current_value FROM {$table} WHERE counter_name = %s FOR UPDATE", $name ) );
		$wpdb->query( $wpdb->prepare( "UPDATE {$table} SET current_value = current_value + 1 WHERE counter_name = %s", $name ) );

		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT current_value FROM {$table} WHERE counter_name = %s", $name ) );
	}

	/** UTC partout — evite les decalages de fuseau du serveur. */
	public static function now(): string {
		return gmdate( 'Y-m-d H:i:s' );
	}
}
