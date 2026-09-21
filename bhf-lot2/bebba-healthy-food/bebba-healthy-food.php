<?php
/**
 * Plugin Name:       BEBBA Healthy Food
 * Plugin URI:        https://github.com/zoubeirsneni-lgtm/bhf
 * Description:       Plateforme BEBBA Healthy Food pour WordPress — boutique client, cuisine, livreurs et administration, avec un systeme d'utilisateurs bebba TOTALEMENT INDEPENDANT des utilisateurs WordPress (table bebba_users, JWT dedie, REST /wp-json/bebba/v1).
 * Version:           0.2.0
 * Requires at least: 6.4
 * Requires PHP:      8.1
 * Author:            BEBBA Healthy Food
 * License:           Proprietary
 * Text Domain:       bebba-healthy-food
 *
 * Regle d'or du projet : les comptes bebba vivent dans bebba_users.
 * JAMAIS de wp_insert_user, is_user_logged_in() ou current_user_can() dans le metier.
 */

if ( ! defined( 'ABSPATH' ) ) {
        exit;
}

define( 'BEBBA_HF_VERSION', '0.2.0' );
define( 'BEBBA_HF_PATH', plugin_dir_path( __FILE__ ) );
define( 'BEBBA_HF_URL', plugin_dir_url( __FILE__ ) );

require_once BEBBA_HF_PATH . 'includes/class-bebba-db.php';
require_once BEBBA_HF_PATH . 'includes/class-bebba-auth.php';
require_once BEBBA_HF_PATH . 'includes/class-bebba-catalog.php';
require_once BEBBA_HF_PATH . 'includes/class-bebba-activator.php';
require_once BEBBA_HF_PATH . 'includes/class-bebba-plugin.php';
require_once BEBBA_HF_PATH . 'api/class-bebba-rest.php';
require_once BEBBA_HF_PATH . 'shortcodes/class-bebba-shortcodes.php';

register_activation_hook( __FILE__, array( 'Bebba_HF_Activator', 'activate' ) );

/**
 * Point d'entree unique declare a la permission eviter les ordres de chargement.
 */
function bebba_hf(): Bebba_HF_Plugin {
        return Bebba_HF_Plugin::instance();
}

add_action( 'plugins_loaded', 'bebba_hf' );
