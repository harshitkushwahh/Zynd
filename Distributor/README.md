# ZYND Distributor

Frontend console for distributors to manage investors, orders, and transactions.

## Run

```bash
# from repo root
npm install
cd Distributor && npm run dev
```

App runs on [http://localhost:9900](http://localhost:9900).

## Backend

The console expects the Zynd API for authentication and client data. Configure `NEXT_PUBLIC_API_URL` if your backend is not proxied at `/api/v1`.
