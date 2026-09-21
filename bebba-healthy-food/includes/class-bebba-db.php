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
