import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";
import Layout from "./components/layout/layout";
import Groups from "./pages/groups/groups";
import GroupDetails from "./pages/groups/groupDetails/groupDetails";
import MyExpenses from "./pages/user/expenses/myExpenses";
import Join from "./pages/join/join";
import EmailVerified from "./pages/emailVerified/emailVerified";
import EmailChange from "./pages/emailChange/emailChange";
import ForgotPassword from "./pages/forgotPassword/forgotPassword";
import ResetPassword from "./pages/resetPassword/resetPassword";
import NoMatch from "./pages/noMatch/noMatch";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import User from "./pages/user/userProfile/user";
import RegisterForm from "./components/register/registerForm";
import Login from "./components/login/loginForm";
import RequireAuth from "./components/auth/requireAuth";
import { DarkModeContextProvider } from "./context/darkModeContext";
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DarkModeContextProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<RegisterForm />} />
              <Route path="/profile" element={<RequireAuth><User /></RequireAuth>} />
              <Route path="/groups" element={<RequireAuth><Groups /></RequireAuth>} />
              <Route path="/groups/:groupId/expenses" element={<RequireAuth><GroupDetails /></RequireAuth>} />
              <Route path="/my-expenses" element={<RequireAuth><MyExpenses /></RequireAuth>} />
              <Route path="/join/:inviteCode" element={<Join />} />
              <Route path="/email-verified" element={<EmailVerified />} />
              <Route path="/email-change" element={<EmailChange />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="*" element={<NoMatch />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </DarkModeContextProvider>
    </QueryClientProvider>
  );
}

export default App;
