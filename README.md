# UDP Alert System

This repository contains a React frontend and a Node.js backend for the UDP
Alert System.

## GitHub Pages frontend

The frontend is deployed automatically by the
[GitHub Pages workflow](.github/workflows/deploy-pages.yml) when changes are
pushed to `main`. In the repository settings, set **Pages → Build and
deployment → Source** to **GitHub Actions**. The site URL is:

<https://raj-dotcom-coder.github.io/UDP-Alert-System/>

GitHub Pages hosts only static files. It cannot run the backend, MongoDB, or
the UDP listener. Until the backend is hosted separately, signing in and using
alerts will show that the backend is not configured.

After hosting the backend, add a repository Actions variable named
`VITE_API_URL` with its HTTPS API base URL, for example
`https://your-api.example.com/api`, then rerun the Pages workflow. The backend
must allow requests from the Pages site and remain reachable by clients.
