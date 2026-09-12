# Déployer Kcal-El sur un VPS OVH

Ce guide part d'un VPS tout neuf jusqu'à l'application accessible sur son
adresse IP en HTTP. Il pose aussi la convention à suivre pour héberger de
futurs sites sur la même machine derrière le même reverse proxy Caddy.

## 1. Commander le VPS

- OVH → VPS → **VPS Value** (2 vCPU / 4 Go RAM / 50 Go NVMe, ~7-8 €/mois) suffit largement pour commencer.
- Image : **Ubuntu 24.04 LTS**.
- Pendant la commande, ajoute ta clé SSH publique (`~/.ssh/id_ed25519.pub` ou équivalent) pour éviter l'auth par mot de passe dès le départ.

## 2. Premier accès et durcissement de base

```bash
ssh root@<IP_DU_VPS>

# Créer un utilisateur non-root
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# Pare-feu : uniquement SSH, HTTP, HTTPS
apt update && apt install -y ufw fail2ban
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Désactiver l'auth par mot de passe SSH
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh
```

Reconnecte-toi ensuite en `deploy@<IP_DU_VPS>` pour la suite.

## 3. Installer Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# se déconnecter/reconnecter pour que le groupe prenne effet
docker compose version
```

## 4. Réseau partagé + reverse proxy Caddy

Un seul Caddy tourne sur la machine, pour tous les sites présents et à venir.

```bash
docker network create web

git clone https://github.com/KevinCelie/Kcal-El.git
cd Kcal-El/deploy/caddy
docker compose up -d
```

## 5. Configurer les secrets

```bash
cd ~/Kcal-El/deploy
cp .env.example .env
sed -i "s/change-me-too/$(openssl rand -base64 24)/" .env
sed -i "s/change-me/$(openssl rand -base64 24)/" .env
cat .env   # vérifier que les deux valeurs ont bien été remplacées
```

`.env` n'est jamais commité (voir `.gitignore`).

## 6. Déployer Kcal-El

```bash
cd ~/Kcal-El/deploy
docker compose up -d --build
```

Vérifie que ça répond :

```bash
curl -I http://localhost/
```

L'app est maintenant accessible sur `http://<IP_DU_VPS>/`.

## 7. Mettre à jour après un changement de code

Automatique désormais (voir section suivante). En manuel si besoin :

```bash
cd ~/Kcal-El
git pull
docker compose -f deploy/docker-compose.yml up -d --build
```

## 7bis. CI/CD (déploiement automatique)

Un workflow GitHub Actions (`.github/workflows/deploy.yml`) se déclenche à
chaque push sur `master` : il se connecte en SSH au VPS et exécute
`git pull --ff-only && docker compose -f deploy/docker-compose.yml up -d --build`.

Ça utilise une clé SSH **dédiée au CI**, différente de la clé d'admin
personnelle — ajoutée à `~/.ssh/authorized_keys` sur le VPS, et dont la
partie privée n'existe que comme secret GitHub chiffré (jamais commitée,
jamais stockée en clair sur un poste).

Secrets du repo GitHub (`gh secret list`) :
- `DEPLOY_SSH_KEY` — clé privée dédiée au déploiement
- `DEPLOY_HOST` — IP du VPS
- `DEPLOY_USER` — `debian`

Pour révoquer l'accès CI (clé compromise, ou plus besoin) sans toucher aux
autres accès :
```bash
ssh debian@<IP_DU_VPS> "grep -v github-actions-kcal-el-deploy ~/.ssh/authorized_keys > /tmp/ak && mv /tmp/ak ~/.ssh/authorized_keys"
```
puis régénérer une nouvelle paire de clés et mettre à jour le secret
`DEPLOY_SSH_KEY` (`gh secret set DEPLOY_SSH_KEY < nouvelle_clé_privée`).

## 8. Administration de la base (Adminer)

Une interface web façon Adminer tourne à côté de Postgres, mais **jamais
exposée publiquement** — uniquement via un tunnel SSH :

```bash
ssh -L 8081:localhost:8081 debian@<IP_DU_VPS>
```

Puis ouvre `http://localhost:8081` dans ton navigateur et connecte-toi avec :
- Système : **PostgreSQL**
- Serveur : `postgres`
- Utilisateur : `kcal_el`
- Mot de passe : la valeur de `POSTGRES_PASSWORD` dans `deploy/.env` sur le VPS
- Base de données : `kcal_el`

Tant que le tunnel SSH n'est pas ouvert, le port 8081 n'est joignable que
depuis le VPS lui-même (`127.0.0.1:8081:8080` dans `docker-compose.yml`).

## 9. Ajouter un nom de domaine + HTTPS (plus tard)

Quand un domaine pointe vers l'IP du VPS (enregistrement DNS `A`) :

1. Édite `~/Kcal-El/deploy/caddy/Caddyfile` : remplace `:80` par ton domaine, ex. `kcal-el.mondomaine.fr`.
2. `cd ~/Kcal-El/deploy/caddy && docker compose restart`

Caddy obtient et renouvelle automatiquement le certificat Let's Encrypt.

## 10. Héberger un futur site sur ce même VPS

Convention à suivre pour chaque nouveau projet :

1. Un dossier dédié (ex. `~/mon-autre-site/`) avec son propre `docker-compose.yml`, qui **rejoint le réseau externe `web`** avec un alias unique pour son service API (ex. `mon-site-api`), comme `deploy/docker-compose.yml` le fait pour `kcal-el-api`.
2. Un bloc supplémentaire dans `~/Kcal-El/deploy/caddy/Caddyfile` :
   ```
   mon-site.mondomaine.fr {
       reverse_proxy mon-site-api:3000
   }
   ```
3. `docker compose restart` dans `deploy/caddy/`.

Le même Caddy, le même VPS, chaque site dans son propre conteneur/réseau interne.
