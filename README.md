<p align="center">
  <img src="./screenshots/logo.png" alt="DivvyUp logo" width="300"/>
</p>

# DivvyUp 💸
DivvyUp is a **web application for splitting group expenses**, designed to help users manage shared costs with friends, roommates, or travel companions.

With DivvyUp, you can create groups, add expenses with multiple participants, and automatically calculate how much each member owes. The app also allows you to settle debts by marking payments as completed, ensuring the group's balance stays up to date.

---


## 🛠️ Tech Stack

### Frontend
- **React 18**
- **VITE**
- **React Router DOM**
- **CSS Modules**
- **Axios**
- **React Toastify**
- **MUI (Material UI)**
- **React Tooltip**
- **Socket.io Client**

### Backend
- **Node.js**
- **Express**
- **MongoDB** (with **Mongoose**)
- **jsonwebtoken**
- **Socket.io**
- **Nodemon**

### Tools
- **Insomnia/Thunder Client** (for testing APIs)
- **MongoDB Compass**
- **npm (package management)**

### Deployment
- 🌐 Frontend: [Netlify](https://www.netlify.com/)
- 🌐 Backend: [Koyeb](https://www.koyeb.com/)
- 🛢️ Database: [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

---


## 📦 Installation & Setup

Follow the steps below to run the project locally.

### 1. Clone the Repository and install dependencies

```bash
git clone https://github.com/nds-fsd/splitwise.git
cd splitwise
npm install
```

### 2. Environment Variables

You need to create two `.env` files:

- One inside the `frontend` folder
- One inside the `backend` folder

#### 📁 Frontend `.env` (located in `frontend/`)

```env
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

#### 📁 Backend `.env` (located in `backend/`)

```env
MONGO_URL=<your_mongo_db_url>
jwt_secret=<your_jwt_secret>
SENDGRID_API_KEY=<your_sendgrid_api_key>
SENGRID_EMAIL=<your_sendgrid_sender_email>

CLOUDINARY_CLOUD_NAME=<your_cloudinary_cloud_name>
CLOUDINARY_API_KEY=<your_cloudinary_api_key>
CLOUDINARY_API_SECRET=<your_cloudinary_api_secret>

CLIENT_URL=http://localhost:3000
```


### 🚀 Running the Project

This project is a **monorepo** that contains both the **frontend** and **backend** in the same repository. You can start both simultaneously with a single command.

From the root directory:

```bash
npm run dev
```


## 📁 Project Structure

```
splitwise/
│
├── backend/                # Backend built with Node.js, Express and MongoDB
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── controllers/    # Route controller logic
│   │   ├── middlewares/    # Custom Express middleware
│   │   ├── mongo/          # MongoDB connection
│   │   ├── routers/        # Express route definitions
│   │   ├── schemas/        # Mongoose models
│   │   ├── security/       # JWT utils and auth logic
│   │   ├── services/       # Core business logic
│   │   ├── socket/         # WebSocket server and event handlers
│   │   ├── tests/          # Unit/integration tests
│   │   └── index.js
│   ├── Dockerfile
│   └── .env                # Environment variables (backend)
│   └── package.json        
│
├── frontend/               # Frontend built with React + Vite
│   ├── public/             # Static assets (e.g., favicon, logo)
│   ├── src/
│   │   ├── assets/         # Images and icons
│   │   ├── components/     # Reusable UI components
│   │   ├── context/        # React context (auth, theme, etc.)
│   │   ├── hooks/          # Custom hooks
│   │   ├── pages/          # Application pages (routes)
│   │   ├── stories/        # Storybook stories
│   │   ├── utils/          # Utility functions
│   │   ├── App.jsx         # Root component
│   │   └── main.jsx        # ReactDOM entry point
│   ├── .env                # Environment variables (frontend)
│   └── index.html
│   └── package.json   
│
├── package.json            # Root package file (monorepo manager)
├── turbo.json              # Turborepo config
└── docker-compose.yaml     # (Optional) Docker setup
```

---

## ✅ Main Features

- Create and manage groups.
- Add expenses within a group.
- Calculate individual user balances.
- Automatically generate debts based on group expenses.
- Mark debts as paid.
- Real-time notifications via WebSockets.
- User authentication and session management.
- Dark mode support.
- Profile image upload with Cloudinary.


## 🌐 Live Demo

You can try the project live here: [https://divvy-up-app.netlify.app/](https://divvy-up-app.netlify.app/) 

---

## 📸 Screenshots

### 🧑‍🤝‍🧑 Groups
![Groups](./screenshots/groups.png)

Overview of the groups in which the user is a member

### 📋 Group details
![Group Details](./screenshots/groupDetails.png)

Displays the details of a specific group, including recorded expenses, user balances, and pending debts.

### 💸 User expenses
![User expenses](./screenshots/userExpenses.png)

Section where the user can view all the expenses they’ve participated in, organized by group.

### 🙋‍♂️ Profile
![Profile](./screenshots/profile.png)

User profile screen with options to edit personal information or log out.

---

## Authors

- [Jorge Álvarez](https://github.com/JorgeAFdev)
- [Alex Biescas](https://github.com/biescaszzz)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).