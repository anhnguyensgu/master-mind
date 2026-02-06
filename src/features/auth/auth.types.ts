// User types
export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  createdAt: Date;
}

export type SafeUser = Omit<User, 'password'>;

// Request types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

// Response types
export interface AuthResponse {
  success: true;
  data: {
    user: SafeUser;
    token: string;
  };
}

export interface UserResponse {
  success: true;
  data: SafeUser;
}
