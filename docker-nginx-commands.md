# Docker Commands to Open Nginx File in Ubuntu Container

## ✅ Your Container: `vendor-management-nginx`

Based on your running containers, use these commands with your nginx container.

### 📝 Apply Updated nginx.conf to Container:

**If you've updated the local nginx.conf file, copy it to the container:**
```bash
# Copy the updated nginx.conf to the container
sudo docker cp ./nginx.conf vendor-management-nginx:/etc/nginx/nginx.conf

# Test the configuration
sudo docker exec -it vendor-management-nginx nginx -t

# If test passes, reload nginx
sudo docker exec -it vendor-management-nginx nginx -s reload
```

**Note:** The docker-compose.yml mounts the local nginx.conf, so if you're using docker-compose, you may need to restart the container:
```bash
sudo docker-compose restart nginx
# or
sudo docker restart vendor-management-nginx
```

---

### ⚠️ Note: `nano` is NOT available in alpine nginx containers. Use `vi` or copy method below.

### Option 1: View the nginx.conf file:
```bash
# View the main nginx.conf file
sudo docker exec -it vendor-management-nginx cat /etc/nginx/nginx.conf
```

### Option 2: Edit with vi (RECOMMENDED - works in alpine):
```bash
# Edit nginx.conf with vi (default editor in alpine)
sudo docker exec -it vendor-management-nginx vi /etc/nginx/nginx.conf
```

**Vi Editor Commands (Step by Step):**
1. Press `i` to enter INSERT mode (you'll see `-- INSERT --` at bottom)
2. Make your edits
3. Press `Esc` to exit INSERT mode (important!)
4. Type `:wq` and press Enter to **save and quit**
   - Or type `:w` then `:q` separately
   - Or type `:x` and press Enter (same as :wq)
5. If you want to quit without saving: Press `Esc`, then type `:q!` and press Enter

**After saving, reload nginx to apply changes:**
```bash
# Test the configuration first (recommended)
sudo docker exec -it vendor-management-nginx nginx -t

# If test passes, reload nginx
sudo docker exec -it vendor-management-nginx nginx -s reload
```

### Option 3: Copy file out, edit locally, copy back (EASIEST):
```bash
# Step 1: Copy nginx.conf from container to local directory
sudo docker cp vendor-management-nginx:/etc/nginx/nginx.conf ./nginx-from-container.conf

# Step 2: Edit it locally with your favorite editor (nano, vim, VS Code, etc.)
# Edit the file: ./nginx-from-container.conf

# Step 3: Copy the edited file back to container
sudo docker cp ./nginx-from-container.conf vendor-management-nginx:/etc/nginx/nginx.conf

# Step 4: Test the configuration
sudo docker exec -it vendor-management-nginx nginx -t

# Step 5: Reload nginx to apply changes
sudo docker exec -it vendor-management-nginx nginx -s reload
```

---

## 🔍 First: Find Your Existing Containers

### List all running containers:
```bash
docker ps
```

### List ALL containers (including stopped):
```bash
docker ps -a
```

### List only container names:
```bash
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
```

### Search for containers with "nginx" in the name:
```bash
docker ps -a | grep nginx
```

### Get container name from container ID:
```bash
docker inspect <container-id> | grep -i name
```

**Once you find your container name, replace `nginx-container` in the commands below with your actual container name!**

---

## Option 1: Run Ubuntu Container with Nginx and Access Config File

### Start an Ubuntu container with nginx installed:
```bash
docker run -it --name nginx-container ubuntu:latest bash
```

### Inside the container, install nginx:
```bash
apt-get update
apt-get install -y nginx nano vim
```

### Open/view the nginx configuration file:
```bash
# View the main nginx config
cat /etc/nginx/nginx.conf

# Edit with nano
nano /etc/nginx/nginx.conf

# Edit with vim
vim /etc/nginx/nginx.conf

# View with less
less /etc/nginx/nginx.conf
```

## Option 2: Copy Your nginx.conf into Running Container

### Copy your local nginx.conf to a running container:
```bash
docker cp FrontEnd/nginx.conf nginx-container:/etc/nginx/nginx.conf
```

### Then access the container:
```bash
docker exec -it nginx-container bash
nano /etc/nginx/nginx.conf
```

## Option 3: Run Container with Volume Mount (Recommended)

### Run Ubuntu container with your nginx.conf mounted:
```bash
docker run -it --name nginx-container \
  -v "$(pwd)/FrontEnd/nginx.conf:/etc/nginx/nginx.conf:ro" \
  ubuntu:latest bash
```

### Or for read-write access:
```bash
docker run -it --name nginx-container \
  -v "$(pwd)/FrontEnd/nginx.conf:/etc/nginx/nginx.conf" \
  ubuntu:latest bash
```

### Then inside container:
```bash
apt-get update
apt-get install -y nginx nano
nano /etc/nginx/nginx.conf
```

## Option 4: Use Official Nginx Docker Image

### Run official nginx container:
```bash
docker run -it --name nginx-container \
  -v "$(pwd)/FrontEnd/nginx.conf:/etc/nginx/nginx.conf" \
  nginx:latest bash
```

### Access and edit:
```bash
docker exec -it nginx-container bash
nano /etc/nginx/nginx.conf
```

## Quick Access Commands

### If container is already running (replace `YOUR-CONTAINER-NAME` with actual name):
```bash
# Open bash in running container
docker exec -it YOUR-CONTAINER-NAME bash

# Directly view nginx.conf
docker exec -it YOUR-CONTAINER-NAME cat /etc/nginx/nginx.conf

# Directly edit with nano
docker exec -it YOUR-CONTAINER-NAME nano /etc/nginx/nginx.conf

# Directly edit with vim
docker exec -it YOUR-CONTAINER-NAME vim /etc/nginx/nginx.conf
```

### Alternative: Use Container ID instead of name:
```bash
# If you only have the container ID, you can use it directly
docker exec -it <container-id> bash
docker exec -it <container-id> nano /etc/nginx/nginx.conf
```

### If container is stopped, start it first:
```bash
# Start stopped container
docker start YOUR-CONTAINER-NAME

# Then access it
docker exec -it YOUR-CONTAINER-NAME bash
```

## Test Nginx Configuration

### After editing, test the config:
```bash
docker exec -it YOUR-CONTAINER-NAME nginx -t
```

### Reload nginx (if running):
```bash
docker exec -it YOUR-CONTAINER-NAME nginx -s reload
```

