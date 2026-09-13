# Deployment Guide — AWS

This app deploys as: **EC2 (compute, single instance) + MariaDB (local database, installed on the same EC2 instance) + Apache httpd (reverse proxy) + S3 (storage) + IAM Role + Security Groups + CloudWatch**

## 1. Create the S3 Bucket
1. S3 Console → Create bucket → give it a globally unique name
2. Keep "Block all public access" ON (the app writes via IAM role, doesn't need public bucket access)
3. Note the bucket name for `S3_BUCKET_NAME`

## 2. Create an IAM Role for EC2
1. IAM Console → Roles → Create role → AWS service → EC2
2. Attach a policy scoped to just your bucket (least privilege), e.g.:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:GetObject"],
    "Resource": "arn:aws:s3:::module-3codomaxdigitalsolutions"
  }]
}
```
3. Name it e.g. `cloud-webapp-ec2-role`

## 3. Launch the EC2 Instance
1. EC2 Console → Launch instance → Amazon Linux 2023, t2.micro
2. Under "Advanced details" → IAM instance profile → select the role from step 2
3. Security group: allow inbound 22 (your IP only) and 80 (anywhere). MariaDB runs locally on this same instance, so no separate DB port needs to be opened to the outside world.
4. Launch and SSH in

## 4. Install and configure MariaDB (local database)
```bash
sudo apt update
sudo apt install -y mariadb-server
sudo systemctl enable mariadb --now

# Secure the installation (set root password, remove anonymous users, etc.)
sudo mysql_secure_installation
```
Create the app database and a dedicated user:
```bash
sudo mysql -u root -p
```
```sql
CREATE DATABASE cloudwebapp;
CREATE USER 'appuser'@'localhost' IDENTIFIED BY 'Zain@123455';
GRANT ALL PRIVILEGES ON cloudwebapp.* TO 'appuser'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```
MariaDB listens on `localhost:3306` only by default — it is **not** reachable from outside the instance, which is why no inbound rule for port 3306 is needed in the security group.

## 5. Install Node.js and deploy the app
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

git clone https://github.com/ZainCloud009/Module_3-Codomax-.git
cd cloud-webapp
npm install --production

cp .env.example .env
nano .env   # DB_HOST=localhost, DB_PASSWORD=<same as above>, S3_BUCKET_NAME=...

# Run with a process manager so it survives reboots/SSH disconnects
sudo npm install -g pm2
pm2 start src/server.js --name cloud-webapp
pm2 startup
pm2 save
```
The app now runs on `localhost:3000`.

## 6. Install and configure Apache httpd as a reverse proxy
```bash
sudo apt install -y apache2
sudo a2enmod proxy proxy_http
```
Edit the default site config:
```bash
sudo nano /etc/httpd/conf.d/Module3.conf
```
Add inside the `<VirtualHost *:80>` block:
```apache
ProxyPreserveHost On
ProxyPass / http://localhost:3000/
ProxyPassReverse / http://localhost:3000/
```
Restart Apache:
```bash
sudo systemctl restart httpd
sudo systemctl enable httpd
```
Apache httpd now listens on port 80 and forwards all traffic to the Node app running on port 3000.

## 7. Enable CloudWatch Logs
Install the CloudWatch agent on the EC2 instance and point it at:
- `pm2` logs (`~/.pm2/logs/`) for application logs
- `/var/log/apache2/access.log` and `error.log` for web server logs

## 8. Verify the live site
- Visit `http://16.171.159.58/` — Apache proxies this to your Node app
- Check `/health` returns `{"status":"ok","db":"connected (MariaDB)"}`
- That public URL is your **Live Website Link** deliverable

## 9. (Optional) Attach a domain
Route 53 → create an A record pointing to your EC2 Elastic IP, so your live link is a real domain instead of a raw IP.

---

## Notes on this architecture
Running MariaDB locally on the same EC2 instance (instead of a managed RDS instance) is simpler to set up and free-tier friendly, but keep in mind for production use:
- No automated backups/failover — you're responsible for backing up the database yourself (e.g., `mysqldump` on a cron schedule)
- If the EC2 instance goes down, both the app and the database go down together
- Scaling the app horizontally (multiple EC2 instances) would require moving to a shared/managed database again
