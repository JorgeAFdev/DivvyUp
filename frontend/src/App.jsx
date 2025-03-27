import React, { useState } from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import "./App.css";
import Layout from "./components/layout/layout";
import Groups from "./pages/groups/groups";
import GroupDetails from "./pages/groups/groupDetails/groupDetails";
import MyExpenses from "./pages/user/expenses/myExpenses";
import NoMatch from "./pages/noMatch/noMatch";
import { QueryClient, QueryClientProvider } from "react-query";
import User from "./pages/user/userProfile/user";
import RegisterForm from "./components/register/registerForm";
import Login from "./components/login/loginForm";
import { DarkModeContextProvider } from "./context/darkModeContext";
import { useAuth } from "./context/userContextAuth";
const queryClient = new QueryClient();

function App() {
  const [forceUpdate, setForceUpdate] = useState(false);
  const { token } = useAuth();

  return (
    <QueryClientProvider client={queryClient}>
      <DarkModeContextProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout forceUpdate={() => setForceUpdate(!forceUpdate)} />}>
              <Route path="/login" element={<Login forceUpdate={() => setForceUpdate(!forceUpdate)} />} />
              <Route
                path="/profile"
                element={token ? <User /> : <Navigate to="/login" />}
              />
              <Route
                path="/groups"
                element={token ? <Groups /> : <Navigate to="/login" />}
              />
              <Route path="/register" element={<RegisterForm />} />
              <Route path="/groups/:groupId/expenses" element={token ? <GroupDetails /> : <Navigate to="/login" />} />
              <Route path="/my-expenses" element={token ? <MyExpenses /> : <Navigate to="/login" />} />
              <Route path="*" element={<NoMatch />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </DarkModeContextProvider>
    </QueryClientProvider>
  );
}

export default App;
