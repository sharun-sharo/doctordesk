# Push DoctorDesk to a new GitHub repository

Your project is already a Git repo with an initial commit. Follow these steps to put it on GitHub.

## 1. Create the repository on GitHub

1. Open **https://github.com/new**
2. **Repository name:** `DoctorDesk` (or any name you prefer)
3. **Description (optional):** `Clinic management app – patients, appointments, prescriptions, billing`
4. Choose **Public**
5. **Do not** add a README, .gitignore, or license (this repo already has them)
6. Click **Create repository**

## 2. Add the remote and push

In a terminal, from the project folder (`DoctorDesk`), run:

```bash
cd /Users/riyashree/Desktop/DoctorDesk

# Replace YOUR_USERNAME with your GitHub username
git remote add origin https://github.com/YOUR_USERNAME/DoctorDesk.git

git branch -M main
git push -u origin main
```

If you use SSH instead of HTTPS:

```bash
git remote add origin git@github.com:YOUR_USERNAME/DoctorDesk.git
git push -u origin main
```

## 3. Done

Your code will be on GitHub at `https://github.com/YOUR_USERNAME/DoctorDesk`.

---

**Note:** `.env` files are in `.gitignore`, so secrets are not pushed. On a new machine or for deployment, copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env`, then fill in the values.
