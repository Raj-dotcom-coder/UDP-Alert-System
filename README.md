# UDP Alert System

This repository contains a React frontend and a Node.js backend for the UDP
Alert System.

## GitHub Pages frontend

The frontend is deployed automatically by the
[GitHub Pages workflow](.github/workflows/deploy-pages.yml) when changes are
pushed to `main`. In the repository settings, set **Pages → Build and
deployment → Source** to **GitHub Actions**. The site URL is:

<https://raj-dotcom-coder.github.io/UDP-Alert-System/>

## Render backend

The [`render.yaml`](render.yaml) Blueprint configures the Node.js HTTP API on
Render. To deploy it, sign in to Render, create a new Blueprint, and select
this GitHub repository. Render generates production admin and JWT secrets.
Retrieve the generated `ADMIN_PASSWORD` from the service's environment settings
to sign in as the `admin` user.

The backend currently falls back to an in-memory MongoDB instance when
`MONGODB_URI` is not set. This is only suitable for a demo: accounts and alerts
are lost whenever the service restarts or its free instance spins down. For
persistent data, create a MongoDB Atlas database and add `MONGODB_URI` as a
secret environment variable in the Render service settings. Never commit the
connection string to this repository.

Render serves the HTTP API used by browser clients. The deployment disables
the UDP listener because Render web services don't provide public inbound UDP.
Native UDP devices therefore cannot connect to this hosted service; browser
clients continue to use HTTP polling.

After hosting the backend, add a repository Actions variable named
`VITE_API_URL` with its HTTPS API base URL, for example
`https://udp-alert-backend.onrender.com/api`, then rerun the Pages workflow.
The API must remain reachable by clients. Free Render web services spin down
after inactivity, so the first request after a period of inactivity may take
about a minute while the service starts.
