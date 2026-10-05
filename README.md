# CodeMaster – Full-Stack Online Coding Platform

CodeMaster is a full-stack online coding practice platform designed to help developers and students solve programming problems, practice multiple programming languages, and improve their problem-solving skills.

The project demonstrates full-stack development using a modern frontend, REST APIs, PostgreSQL, authentication, and cloud deployment.

## 🚀 Live Demo

**Frontend:**
https://code-master-coding-platform.vercel.app/

**Backend API:**
https://codemaster-api-rssx.onrender.com/

**GitHub Repository:**
https://github.com/Bavaji12/CodeMaster-Coding-Platform.git

---

## ✨ Features

* 🔐 User authentication and protected routes
* 🧩 Coding problem listing
* 📖 Problem description and details
* 💻 Online coding interface
* 📝 Support for multiple programming languages
* 🔎 Problem search and filtering
* 📊 User-friendly coding dashboard
* 🔗 Frontend–backend REST API integration
* 🗄️ PostgreSQL database
* ⚡ Fast and responsive UI
* 🌐 Cloud deployment
* 🔒 Environment-variable based configuration

---

## 🛠️ Tech Stack

### Frontend

* React
* TypeScript
* Vite
* HTML5
* CSS3
* JavaScript

### Backend

* Node.js
* Express.js
* REST APIs

### Database

* PostgreSQL
* Drizzle ORM

### Deployment

* Vercel – Frontend
* Render – Backend

### Development Tools

* Git
* GitHub
* VS Code
* npm

---

## 📂 Project Structure

```text
CodeMaster-Coding-Platform/
│
├── artifacts/
│   │
│   ├── codemaster/
│   │   ├── src/
│   │   ├── public/
│   │   ├── package.json
│   │   └── ...
│   │
│   └── api-server/
│       ├── src/
│       ├── package.json
│       ├── drizzle/
│       └── ...
│
├── README.md
└── ...
```

---

## ⚙️ Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Bavaji12/CodeMaster-Coding-Platform.git
```

```bash
cd CodeMaster-Coding-Platform
```

---

## 💻 Frontend Setup

Navigate to the frontend:

```bash
cd artifacts/codemaster
```

Install dependencies:

```bash
npm install
```

Create the required environment file:

```text
.env
```

Add the backend API URL:

```env
VITE_API_URL=http://localhost:5000
```

Start the development server:

```bash
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:5173
```

---

## 🖥️ Backend Setup

Open another terminal and navigate to the backend:

```bash
cd artifacts/api-server
```

Install dependencies:

```bash
npm install
```

Configure the required environment variables.

Example:

```env
PORT=5000
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_secret_key
```

Start the backend:

```bash
npm run dev
```

The API will normally run at:

```text
http://localhost:5000
```

---

## 🗄️ Database

CodeMaster uses **PostgreSQL** for persistent data storage.

The database manages information such as:

* Users
* Coding problems
* Authentication-related data
* User/problem-related records

**Drizzle ORM** is used to interact with the PostgreSQL database.

---

## 🔌 REST API

The frontend communicates with the backend through REST APIs.

Typical API operations include:

```text
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
GET    /api/problems
GET    /api/problems/:id
```

The exact available endpoints may vary depending on the current backend implementation.

---

## 🔐 Authentication

The application includes authentication and protected routes.

The general authentication flow is:

```text
User
  ↓
Login/Register
  ↓
Backend Authentication
  ↓
Session / Authentication Cookie
  ↓
Protected API Routes
  ↓
Authenticated User
```

Sensitive configuration such as database credentials and authentication secrets should be stored in environment variables and should **never be committed to GitHub**.

---

## 🧩 Coding Problems

CodeMaster includes **20+ seeded coding problems** covering common programming and DSA concepts.

Problems can be organized around topics such as:

* Arrays
* Strings
* Searching
* Sorting
* Hashing
* Two Pointers
* Sliding Window
* Linked Lists
* Stack
* Queue
* Basic Algorithms

The platform is designed to make it easy to add more problems in the future.

---

## 💡 Supported Programming Languages

The coding platform is designed around multi-language programming practice, including:

* Python
* JavaScript
* Java
* C++

Language support depends on the current code-execution implementation of the deployed version.

---

## 🌐 Deployment

### Frontend – Vercel

The frontend is deployed using Vercel.

```text
https://code-master-coding-platform.vercel.app/
```

### Backend – Render

The backend API is deployed using Render.

```text
https://codemaster-api-rssx.onrender.com/
```

Environment variables are configured separately for the deployed environments.

---

## 🧪 Testing

Important areas to test include:

### Authentication

* Register with valid details
* Register with duplicate email
* Login with valid credentials
* Login with invalid credentials
* Empty input validation
* Protected routes
* Logout/session handling

### Problems

* Load problem list
* Open problem details
* Search problems
* Filter problems
* Handle invalid problem IDs
* Verify problem data

### API

* Valid API requests
* Invalid requests
* Unauthorized requests
* Server errors
* Database failures
* CORS configuration

### UI

* Responsive layout
* Navigation
* Loading states
* Error messages
* Empty states
* Browser compatibility

---

## 🐛 Known Limitations

The project is continuously being improved. Some authentication/session behavior may depend on browser cookie policies and the deployed frontend/backend configuration.

For production improvements, authentication and cross-origin cookie handling should be thoroughly validated across supported browsers and environments.

---

## 🔮 Future Improvements

Planned improvements can include:

* Online code execution
* Test-case execution
* Submission history
* User progress tracking
* Leaderboards
* Difficulty-based filtering
* User profiles
* Bookmark/favorite problems
* Dark/light theme
* Advanced DSA problem sets
* Automated test execution
* Docker-based code execution
* CI/CD pipeline
* Automated frontend and API testing
* Playwright end-to-end testing

---

## 🎯 Project Goals

The main goals of CodeMaster are:

1. Provide a simple platform for coding practice.
2. Demonstrate full-stack application development.
3. Implement frontend and backend communication using REST APIs.
4. Work with a relational PostgreSQL database.
5. Implement authentication and protected routes.
6. Deploy a complete application to the cloud.
7. Create a foundation that can be extended with online code execution and competitive-programming features.

---

## 👨‍💻 Developer

**Shaik Bavaji**

Final-year student with interests in:

* Full-Stack Development
* Python
* Artificial Intelligence
* Machine Learning
* Data Structures & Algorithms
* Software Testing
* QA Automation

### Technologies

`Python` `JavaScript` `TypeScript` `React` `Node.js` `Express.js` `PostgreSQL` `Drizzle` `REST API` `Git` `GitHub`

---

## 📄 License

This project is intended for educational and portfolio purposes.

---

⭐ If you find this project useful, consider giving the repository a star!
