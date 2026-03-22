# SAI Rolotech Smart Engines — Windows .exe Build Guide

## Kaise kaam karta hai?

Aap code GitHub par push karo → GitHub ka Windows server automatically .exe build karta hai → Aap download kar lo.

---

## STEP 1 — GitHub Repository Banao

1. **github.com** par jaao aur login karo
2. Top-right mein **"+"** button dabao → **"New repository"**
3. Repository name: `sai-rolotech-smart-engines`
4. Private ya Public — aapki marzi
5. **"Create repository"** dabao
6. Repository URL copy karo — kuch is tarah hogi:
   `https://github.com/AAPKA-NAME/sai-rolotech-smart-engines.git`

---

## STEP 2 — Replit se GitHub Connect Karo

Replit mein:
1. Left sidebar mein **Git** icon (branch icon) dabao
2. **"Connect to GitHub"** dabao
3. GitHub account se connect karo (ek baar ka kaam)
4. Apni repository select karo
5. **"Push"** dabao — code GitHub par chala jayega

---

## STEP 3 — Build Automatically Shuru Ho Jayegi

GitHub par jaao → Aapki repository → **"Actions"** tab click karo

Aapko dikhega: **"Build Windows Installer"** — yellow circle matlab build chal rahi hai.

**15-20 minute** mein build complete ho jati hai.

---

## STEP 4 — .exe Download Karo (Bina Release ke)

Actions tab mein:
1. Latest build click karo
2. Neeche **"Artifacts"** section mein jaao
3. **"SAI-Rolotech-Smart-Engines-v2.2.0-Windows"** click karo
4. ZIP download hoga → unzip karo → **.exe milega**

---

## STEP 5 — Proper Release Banao (Official Download Link)

GitHub par proper release banane ke liye:

1. Repository page par **"Releases"** click karo (right side)
2. **"Create a new release"** dabao
3. **"Choose a tag"** → type karo: `v2.2.0` → **"Create new tag"**
4. Title: `SAI Rolotech Smart Engines v2.2.0`
5. **"Publish release"** dabao

15-20 minute mein build complete ho jayegi aur **.exe files automatically Releases page par aa jayengi.**

---

## Download Karne ke Baad

1. **Setup.exe** chalao → Install karo → Done
   - Desktop par shortcut ban jata hai
   - Start Menu mein entry ban jati hai
   - Koi Node.js nahi chahiye, koi internet nahi chahiye

2. Ya **Portable.exe** seedha chalao — koi install bhi nahi karna

---

## Files jo milti hain

| File | Size (approx) | Use |
|------|---------------|-----|
| `SAI-Rolotech-Setup.exe` | ~150 MB | Full installer with Start Menu |
| `SAI-Rolotech-Portable.exe` | ~150 MB | Direct run, no install needed |

---

**Note:** Build ek baar hoti hai. Phir kabhi bhi download kar sakte ho GitHub Releases page se.
