-- ============================================================================
-- BEBBA Healthy Food — Delta schema v2 : independance totale vis-a-vis de wp_users
-- ----------------------------------------------------------------------------
-- A appliquer SUR le schema BLOC 3 existant (mysql_schema_bebba.sql).
-- Ne s'applique PAS a wp_users ; supprime toutes les references de comptes
-- bebba vers les utilisateurs WordPress.
--
-- Ordre d'application obligatoire : 1) bebba_users, 2) bebba_drivers, 3) bebba_orders.
-- Moteur : InnoDB | utf8mb4_unicode_ci | MySQL 8.x
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- 1. NOUVELLE TABLE : bebba_users (comptes bebba — clients ET personnel)
-- ----------------------------------------------------------------------------
-- Miroir exact de la collection Firestore 'users' (server/db.ts).
-- AUCUN lien vers wp_users. Auth : telephone (clients) ou username (staff)
-- + mot de passe bcrypt (cost 10) + JWT signe par le plugin.
-- ============================================================================
CREATE TABLE `bebba_users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `legacy_id` VARCHAR(64) NULL COMMENT 'ID Firestore original (ex: usr-driver-1) — NULL pour comptes post-migration',
    `username` VARCHAR(64) NULL COMMENT 'Identifiant staff (clients = NULL, jamais rempli pour role=client)',
    `phone` VARCHAR(20) NULL COMMENT 'Telephone normalise client (staff = NULL). Normalisation identique a normalizePhoneNumber',
    `name` VARCHAR(128) NOT NULL,
    `address` VARCHAR(255) NULL,
    `password_hash` VARCHAR(255) NOT NULL COMMENT 'password_hash PHP PASSWORD_BCRYPT cost 10 (compatible hachages bcryptjs $2a$/$2b$)',
    `role` ENUM('client','kitchen','driver','admin','admin_readonly') NOT NULL,
    `driver_id` BIGINT UNSIGNED NULL COMMENT 'FK bebba_drivers.id — uniquement pour role=driver. Sens unique : le lien vit ICI (pas de colonne miroir chez drivers)',
    `active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '0 = connexion refusee a chaque requete (revocation des JWT existants incluse)',
    `token_version` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Invalide tous les JWT emis si incremente',
    `must_change_password` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Force le changement de mot de passe au premier login (comptes semés)',
    `last_login_at` DATETIME NULL,
    `legacy_created_at` DATETIME NULL,
    `legacy_updated_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_bebba_users_legacy_id` (`legacy_id`),
    UNIQUE KEY `uk_bebba_users_username` (`username`),
    UNIQUE KEY `uk_bebba_users_phone` (`phone`),
    KEY `idx_bebba_users_role` (`role`),
    KEY `idx_bebba_users_driver_id` (`driver_id`),
    KEY `idx_bebba_users_active` (`active`),
    CONSTRAINT `fk_bebba_users_driver` FOREIGN KEY (`driver_id`)
        REFERENCES `bebba_drivers` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Comptes bebba (clients + personnel) — systeme d utilisateurs INDEPENDANT de wp_users';

-- ============================================================================
-- 2. bebba_drivers — suppression du mapping wp_users (mapping BLOC 1 gele ABANDONNE)
-- ----------------------------------------------------------------------------
-- La fiche livreur devient autonome. Le compte de connexion du livreur vit
-- exclusivement dans bebba_users (role=driver, driver_id -> bebba_drivers.id).
-- ============================================================================
ALTER TABLE `bebba_drivers`
    DROP FOREIGN KEY `fk_bebba_drivers_user`,
    DROP INDEX `uk_bebba_drivers_user_id`,
    DROP COLUMN `user_id`,
    MODIFY `legacy_user_id` VARCHAR(64) NULL COMMENT 'ID legacy User Firestore (ex: usr-driver-1) — trace uniquement, la liaison reelle vit dans bebba_users.driver_id',
    COMMENT='Livreurs BEBBA (fiche metier autonome ; compte de connexion = bebba_users role=driver)';

-- ============================================================================
-- 3. bebba_orders — client bebba au lieu de client WordPress
-- ----------------------------------------------------------------------------
-- wp_customer_id (wp_users) remplace par client_id (bebba_users).
-- NULL = commande invite. Les infos client restent denormalisees
-- (customer_name / customer_phone / delivery_address) comme aujourd'hui.
-- ============================================================================
ALTER TABLE `bebba_orders`
    DROP INDEX `idx_bebba_orders_wp_customer_id`,
    DROP COLUMN `wp_customer_id`,
    ADD COLUMN `client_id` BIGINT UNSIGNED NULL AFTER `customer_notes` COMMENT 'FK bebba_users.id (role=client) — NULL pour commandes invite',
    ADD COLUMN `client_legacy_id` VARCHAR(64) NULL AFTER `client_id` COMMENT 'ID legacy User Firestore du client (traçabilité migration)',
    ADD KEY `idx_bebba_orders_client_id` (`client_id`),
    ADD CONSTRAINT `fk_bebba_orders_client` FOREIGN KEY (`client_id`)
        REFERENCES `bebba_users` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE,
    COMMENT='Commandes BEBBA (tete de commande ; client_id = bebba_users, jamais wp_users)';

-- ============================================================================
-- 4. Notes post-application
-- ----------------------------------------------------------------------------
-- a) bebba_migration_map gere deja legacy_type='user' : aucune modification.
--    Les imports ecriront : legacy_type='user', target_table='bebba_users'.
-- b) L'ancien mapping "User -> wp_users.display_name" des drivers est mort :
--    le nom affiche d'un livreur = bebba_drivers.name (source de verite, comme
--    aujourd'hui Driver.name) ; ses identifiants de connexion = bebba_users.
-- c) Ne PAS retirer les colonnes legacy_* : elles servent a la migration
--    Firestore (BLOC 5B) et a la quarantaine.
-- d) En production, creer un utilisateur MySQL dedie avec uniquement les
--    privileges DML/SELECT sur les tables bebba_* (pas de DDL apres l'activation).
-- ============================================================================
SET FOREIGN_KEY_CHECKS = 1;
