-- Aliments et recettes communs à tous les utilisateurs.
--
-- Aucune donnée n'est modifiée ni supprimée : `user_id` reste en place, mais
-- il devient simplement « créé par » (informatif). Il est désormais facultatif
-- et la suppression d'un compte ne supprime plus ce qu'il a créé (SET NULL),
-- puisque ces données appartiennent à tout le monde.

ALTER TABLE foods DROP CONSTRAINT IF EXISTS foods_user_id_fkey;
ALTER TABLE foods
  ADD CONSTRAINT foods_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE recipes ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_user_id_fkey;
ALTER TABLE recipes
  ADD CONSTRAINT recipes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN foods.user_id IS 'Créateur (informatif). NULL = base d''origine ou créateur supprimé.';
COMMENT ON COLUMN recipes.user_id IS 'Créateur (informatif). NULL = créateur supprimé.';
