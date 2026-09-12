# Déployer CaloTrack sur un VPS OVH

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

## 5. Déployer CaloTrack

```bash
cd ~/Kcal-El/deploy
docker compose up -d --build
```

Vérifie que ça répond :

```bash
curl -I http://localhost/
```

L'app est maintenant accessible sur `http://<IP_DU_VPS>/`.

## 6. Mettre à jour après un changement de code

```bash
cd ~/Kcal-El
git pull
docker compose -f deploy/docker-compose.yml up -d --build
```

## 7. Ajouter un nom de domaine + HTTPS (plus tard)

Quand un domaine pointe vers l'IP du VPS (enregistrement DNS `A`) :

1. Édite `~/Kcal-El/deploy/caddy/Caddyfile` : remplace `:80` par ton domaine, ex. `calotrack.mondomaine.fr`.
2. `cd ~/Kcal-El/deploy/caddy && docker compose restart`

Caddy obtient et renouvelle automatiquement le certificat Let's Encrypt.

## 8. Héberger un futur site sur ce même VPS

Convention à suivre pour chaque nouveau projet :

1. Un dossier dédié (ex. `~/mon-autre-site/`) avec son propre `docker-compose.yml`, qui **rejoint le réseau externe `web`** avec un alias unique pour son service API (ex. `mon-site-api`), comme `deploy/docker-compose.yml` le fait pour `calotrack-api`.
2. Un bloc supplémentaire dans `~/Kcal-El/deploy/caddy/Caddyfile` :
   ```
   mon-site.mondomaine.fr {
       reverse_proxy mon-site-api:3000
   }
   ```
3. `docker compose restart` dans `deploy/caddy/`.

Le même Caddy, le même VPS, chaque site dans son propre conteneur/réseau interne.
