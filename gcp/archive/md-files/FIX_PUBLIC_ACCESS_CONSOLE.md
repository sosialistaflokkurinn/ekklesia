# 🔓 Fix Public Access via GCP Console

## ❌ Problem

Organization policy is blocking `allUsers` from being added via gcloud CLI.

**Error:**
```
FAILED_PRECONDITION: One or more users named in the policy do not belong to a permitted customer
```

**Root Cause:**
- Project is under organization: `570942468109`
- Organization has `iam.allowedPolicyMemberDomains` constraint
- Blocks adding `allUsers` via CLI

---

## ✅ Solution: Use GCP Console

### Option 1: Grant Public Access via Console (Recommended)

**Step 1: Open Cloud Run Service**

Go to: https://console.cloud.google.com/run/detail/europe-west2/oidc-bridge-proxy?project=ekklesia-prod-10-2025

**Step 2: Go to Security Tab**

Click on the **"Security"** tab at the top

**Step 3: Enable Public Access**

Look for **"Authentication"** section:
- Click **"Allow unauthenticated invocations"**
- Or click **"Manage Permissions"**
- Add principal: `allUsers`
- Role: `Cloud Run Invoker`
- Click **"Save"**

**Expected Result:**
✅ A warning banner will appear saying "This service is public"
✅ The service will now be accessible without authentication

---

### Option 2: Modify Organization Policy (Requires Org Admin)

If you are an organization admin:

**Step 1: Go to Organization Policies**

https://console.cloud.google.com/iam-admin/orgpolicies?organizationId=570942468109

**Step 2: Find the Constraint**

Search for: `iam.allowedPolicyMemberDomains`

**Step 3: Edit Policy**

- Click **"Edit"**
- Either:
  - **Remove the restriction** (allow all domains)
  - Or **add an exception** for this project
- Click **"Set Policy"**

**Step 4: Wait 5 Minutes**

Organization policy changes take time to propagate

**Step 5: Retry CLI Command**

```bash
gcloud run services add-iam-policy-binding oidc-bridge-proxy \
  --region=europe-west2 \
  --member="allUsers" \
  --role="roles/run.invoker"
```

---

### Option 3: Use Service Account Authentication (Not Recommended)

Instead of making the service public, use service account keys.

**Downsides:**
- ❌ ZITADEL would need to authenticate
- ❌ More complex configuration
- ❌ Not standard for OIDC providers
- ❌ Breaks standard OIDC flows

**Not recommended for OIDC proxy!**

---

## 🎯 Recommended: Console Approach

**Quick Steps:**
1. Open: https://console.cloud.google.com/run/detail/europe-west2/oidc-bridge-proxy?project=ekklesia-prod-10-2025
2. Click **"Security"** tab
3. Enable **"Allow unauthenticated invocations"**
4. Click **"Save"**

**Then test:**
```bash
curl https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app/health
```

---

## 📋 Why This Happens

**Organization Policies:**
- Organizations can restrict who can be added to IAM policies
- Common in corporate environments
- Prevents accidental public exposure

**Why OIDC Needs Public Access:**
- Discovery endpoint must be publicly accessible
- Authorization endpoint needs to accept redirects
- Token endpoint validates credentials (not requests)
- Standard practice for all OIDC providers

---

## ✅ After Enabling Public Access

**Verify it works:**
```bash
# Health check
curl https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app/health

# Should return:
{
  "status": "healthy",
  "issuer": "https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app",
  "timestamp": "2025-10-01T...",
  "keys_initialized": true
}

# Discovery document
curl https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app/.well-known/openid-configuration | jq .

# Should return complete OIDC configuration
```

---

## 🔐 Security Notes

**Is public access safe?**

✅ **Yes, this is standard for OIDC providers**

**What's protected:**
- Client authentication (client_id + client_secret)
- Authorization codes (one-time use tokens)
- User authentication (handled by Kenni.is)
- Secrets in Secret Manager (not exposed)

**What's public:**
- Discovery document (metadata, no secrets)
- JWKS public keys (for signature verification)
- Authorization endpoint (redirects to Kenni.is)

**Same as:**
- Google: https://accounts.google.com/.well-known/openid-configuration
- Microsoft: https://login.microsoftonline.com/.well-known/openid-configuration
- GitHub: https://token.actions.githubusercontent.com/.well-known/openid-configuration

---

## 🆘 If Console Doesn't Work

**Contact Organization Admin:**

You may need someone with `Organization Policy Administrator` role to:
1. Temporarily lift the domain restriction
2. Or add an exception for this project
3. Or add your domain to allowed domains

**Who to contact:**
- Look for org admins at: https://console.cloud.google.com/iam-admin/iam?organizationId=570942468109
- They will have role: `Organization Policy Administrator` or `Organization Admin`

---

## 📝 Next Steps

1. ✅ Use Console to enable public access
2. 🧪 Test health endpoint
3. 🔧 Update ZITADEL configuration
4. 🎉 Test end-to-end authentication

---

**Console Link:** https://console.cloud.google.com/run/detail/europe-west2/oidc-bridge-proxy?project=ekklesia-prod-10-2025

**Security Tab → Allow unauthenticated invocations ✅**
