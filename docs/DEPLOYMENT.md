# Deployment Guide — AWS

This app deploys as: **EC2 (compute) + RDS PostgreSQL (database) + S3 (storage) + IAM Role + Security Groups + CloudWatch**

## 1. Create the RDS Database
1. RDS Console → Create database → PostgreSQL → Free tier template
2. Set DB instance identifier, master username/password (save these — you'll need them for `.env`)
3. **Do not** make it publicly accessible — it should only be reachable from your EC2 instance's security group
4. Once available, copy the endpoint into `DB_HOST` in your `.env`

## 2. Create the S3 Bucket
1. S3 Console → Create bucket → give it a globally unique name
2. Keep "Block all public access" ON (the app writes via IAM role, doesn't need public bucket access)
3. Note the bucket name for `S3_BUCKET_NAME`

## 3. Create an IAM Role for EC2
1. IAM Console → Roles → Create role → AWS service → EC2
2. Attach a policy scoped to just your bucket (least privilege), e.g.:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:GetObject"],
    "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
  }]
}
```
3. Name it e.g. `cloud-webapp-ec2-role`

## 4. Launch the EC2 Instance
1. EC2 Console → Launch instance → Ubuntu 22.04 LTS, t2.micro
2. Under "Advanced details" → IAM instance profile → select the role from step 3
3. Security group: allow inbound 22 (your IP), 80 (anywhere), and allow outbound to RDS's security group on port 5432
4. Launch and SSH in

## 5. Deploy the app on EC2
```bash
# On the EC2 instance
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

git clone <your-repo-url>
cd cloud-webapp
npm install --production

cp .env.example .env
nano .env   # fill in DB_HOST, DB_PASSWORD, S3_BUCKET_NAME, etc.

# Run with a process manager so it survives reboots/SSH disconnects
sudo npm install -g pm2
pm2 start src/server.js --name cloud-webapp
pm2 startup
pm2 save
```

## 6. Point port 80 to your app (optional but cleaner than PORT=80)
```bash
sudo apt install -y nginx
```
Configure `/etc/nginx/sites-available/default` to reverse proxy `localhost:3000` → port 80, then:
```bash
sudo systemctl restart nginx
```

## 7. Enable CloudWatch Logs
1. Install the CloudWatch agent on the EC2 instance, or
2. Simplest path: since `pm2` and the app log to stdout, attach the CloudWatch Logs agent to ship `/var/log/` and `pm2 logs` output — or use `pm2-logrotate` + CloudWatch agent config pointing at the pm2 log files.

## 8. Verify the live site
- Visit `http://<your-ec2-public-ip>` (or your domain if you set up Route 53)
- Check `/health` returns `{"status":"ok","db":"connected"}`
- That public URL is your **Live Website Link** deliverable

## 9. (Optional) Attach a domain
Route 53 → create an A record pointing to your EC2 Elastic IP, so your live link is a real domain instead of a raw IP.

---

## Alternative: Elastic Beanstalk (simpler, more "PaaS")
If you'd rather not manage EC2 directly:
```bash
npm install -g eb-cli
eb init -p node.js-20 cloud-webapp
eb create cloud-webapp-env
eb setenv DB_HOST=... DB_PASSWORD=... S3_BUCKET_NAME=...
eb deploy
eb open
```
Elastic Beanstalk provisions the EC2 instance, security group, and load balancer for you — good if you want to focus on the app layer for this module.
