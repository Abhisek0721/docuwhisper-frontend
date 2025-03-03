import { Route, BrowserRouter, Routes, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import { Toaster } from 'react-hot-toast';
import { getUserAccessToken } from './utils/localStorageUtils';
import { ReactNode } from 'react';
import { Conversation } from './components/Conversation';

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const accessToken = getUserAccessToken();
  if (!accessToken) {
    localStorage.clear();
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" reverseOrder={false} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route path="/conversation" element={<Conversation />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
