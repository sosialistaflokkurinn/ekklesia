# 🎯 Quick Onboarding Summary - Ekklesia GCP Project

**READ FULL ONBOARDING:** `AI_ONBOARDING.md`

---

## 30-Second Summary

**Project:** Migrate Ekklesia voting system authentication to production GCP  
**Status:** OIDC Proxy deployed ✅, Database setup needed ⏳  
**User:** Guðröður (gudrodur@sosialistaflokkurinn.is) - Fedora Linux, can sudo  
**Region:** europe-west2 (London)

---

## Critical Info

### Working URL (Use This!)
```
https://oidc-bridge-proxy-521240388393.europe-west2.run.app
```

### Active Account Must Be
```bash
gcloud config set account gudrodur@sosialistaflokkurinn.is
```

### Current Issue to Fix
```bash
# PROXY_ISSUER points to wrong URL, needs update:
gcloud run services update oidc-bridge-proxy \
  --region=europe-west2 \
  --set-env-vars=PROXY_ISSUER=https://oidc-bridge-proxy-521240388393.europe-west2.run.app
```

---

## Next Task: Database Setup

```bash
# Create PostgreSQL for ZITADEL
gcloud sql instances create zitadel-db \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-7680 \
  --region=europe-west2 \
  --storage-size=10GB \
  --storage-type=SSD \
  --storage-auto-increase

# Create database
gcloud sql databases create zitadel --instance=zitadel-db

# Create user
gcloud sql users create zitadel \
  --instance=zitadel-db \
  --password=<GENERATE_STRONG_PASSWORD>
```

---

## Essential Files

- **AI_ONBOARDING.md** - Full onboarding (read this!)
- **DEPLOYMENT_SUCCESS.md** - What's been done
- **QUICK_REFERENCE.md** - Common commands
- **IAM_TROUBLESHOOTING.md** - Permission issues

---

## Remember

✅ Use europe-west2 region  
✅ Use gudrodur@sosialistaflokkurinn.is account  
✅ IAM changes take 5-10 minutes to propagate  
✅ Organization policies may block some CLI operations (use Console)  
✅ User can run sudo (provide commands, don't execute)  
✅ Fedora Linux (dnf, not apt)

---

**NOW READ:** `AI_ONBOARDING.md` for complete context! 📖
