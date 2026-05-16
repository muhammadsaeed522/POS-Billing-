import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { LoginScreen } from "./LoginScreen";
import { SignupScreen } from "./SignupScreen";
import { ForgotPasswordScreen } from "./ForgotPasswordScreen";
import { ResetPasswordScreen } from "./ResetPasswordScreen";
import { SetupInitialAdminScreen } from "./SetupInitialAdminScreen";

export function AuthGateway() {
  const {
    authError,
    setAuthError,
    loggingIn,
    login,
    signup,
    forgotPassword,
    resetPassword,
    authScreen,
    setAuthScreen,
    resetToken,
    setResetToken,
    needsSetup,
    setupLoading,
    setupInitialAdmin
  } = useAuth();

  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState(null);
  const [signupSuccess, setSignupSuccess] = useState(null);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState(null);
  const [forgotMessage, setForgotMessage] = useState(null);
  const [forgotToken, setForgotToken] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState(null);

  if (needsSetup) {
    return (
      <SetupInitialAdminScreen
        loading={setupLoading}
        error={authError}
        onSubmit={(form) => {
          void setupInitialAdmin(form);
        }}
      />
    );
  }

  if (authScreen === "signup") {
    return (
      <SignupScreen
        loading={signupLoading}
        error={signupError}
        success={signupSuccess}
        onLogin={() => {
          setAuthScreen("login");
          setSignupError(null);
          setSignupSuccess(null);
        }}
        onSubmit={async (form) => {
          setSignupLoading(true);
          setSignupError(null);
          setSignupSuccess(null);
          try {
            const res = await signup(form);
            if (res.ok) {
              setSignupSuccess("Account created. You can sign in now.");
              setTimeout(() => setAuthScreen("login"), 1500);
            } else setSignupError(res.error);
          } finally {
            setSignupLoading(false);
          }
        }}
      />
    );
  }

  if (authScreen === "forgot") {
    return (
      <ForgotPasswordScreen
        loading={forgotLoading}
        error={forgotError}
        message={forgotMessage}
        resetToken={forgotToken}
        onLogin={() => {
          setAuthScreen("login");
          setForgotError(null);
        }}
        onReset={(t) => {
          setResetToken(t);
          setAuthScreen("reset");
        }}
        onSubmit={async (email) => {
          setForgotLoading(true);
          setForgotError(null);
          setForgotMessage(null);
          setForgotToken(null);
          try {
            const res = await forgotPassword(email);
            if (res.ok) {
              setForgotMessage(res.message);
              if (res.resetToken) setForgotToken(res.resetToken);
            } else setForgotError(res.error);
          } finally {
            setForgotLoading(false);
          }
        }}
      />
    );
  }

  if (authScreen === "reset") {
    return (
      <ResetPasswordScreen
        loading={resetLoading}
        error={resetError}
        initialToken={resetToken}
        onLogin={() => {
          setAuthScreen("login");
          setResetError(null);
        }}
        onSubmit={async (payload) => {
          setResetLoading(true);
          setResetError(null);
          try {
            const res = await resetPassword(payload);
            if (res.ok) {
              setAuthScreen("login");
              setAuthError("Password updated. Please sign in.");
            } else setResetError(res.error);
          } finally {
            setResetLoading(false);
          }
        }}
      />
    );
  }

  return (
    <LoginScreen
      loading={loggingIn}
      error={authError}
      onSignup={() => {
        setAuthError(null);
        setAuthScreen("signup");
      }}
      onForgot={() => {
        setAuthError(null);
        setAuthScreen("forgot");
      }}
      onSubmit={(id, pass, remember) => {
        void login(id, pass, remember);
      }}
    />
  );
}
