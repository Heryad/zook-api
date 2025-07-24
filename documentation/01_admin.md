# Admin API Documentation

## Overview
The Admin API provides endpoints for managing administrator accounts in the system. Administrators have different roles (super_admin, admin, finance, support, operator) and can be assigned to specific countries and cities.

## Authentication
All admin endpoints (except login) require a valid JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Endpoints

### Login
- **POST** `/admin/login`
- **Description**: Authenticates an admin and returns a JWT token
- **Request Body**:
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "admin": {
        "id": "uuid",
        "username": "string",
        "email": "string",
        "role": "super_admin|admin|finance|support|operator",
        "country_id": "uuid",
        "country_name": "string",
        "city_id": "uuid",
        "city_name": "string",
        "full_name": "string",
        "phone_number": "string",
        "photo_media_id": "uuid",
        "photo_url": "string",
        "is_active": true,
        "last_login_at": "datetime",
        "created_at": "datetime",
        "updated_at": "datetime"
      },
      "token": "string"
    }
  }
  ```

### Get All Admins
- **GET** `/admin`
- **Description**: Retrieves a paginated list of admins
- **Query Parameters**:
  - search?: string (search in username, email, full_name)
  - role?: AdminRole
  - country_id?: string
  - city_id?: string
  - is_active?: boolean
  - page?: number (default: 1)
  - limit?: number (default: 10)
  - sort_by?: 'username' | 'role' | 'created_at'
  - sort_order?: 'asc' | 'desc'
- **Response**:
  ```json
  {
    "success": true,
    "message": "Admins retrieved successfully",
    "data": {
      "admins": [AdminResponse],
      "total": number,
      "page": number,
      "limit": number,
      "totalPages": number
    }
  }
  ```

### Create Admin
- **POST** `/admin`
- **Description**: Creates a new admin account
- **Access**: Limited by role and location
- **Request Body**:
  ```json
  {
    "username": "string",
    "password": "string",
    "email": "string",
    "role": "AdminRole",
    "country_id": "uuid",
    "city_id": "uuid",
    "full_name": "string",
    "phone_number": "string",
    "photo_media_id": "uuid"
  }
  ```
- **Response**: Returns created AdminResponse object

### Update Admin
- **PUT** `/admin/:id`
- **Description**: Updates an existing admin account
- **Access**: Limited by role and location
- **Request Body**: All fields are optional
  ```json
  {
    "username": "string",
    "password": "string",
    "email": "string",
    "role": "AdminRole",
    "country_id": "uuid",
    "city_id": "uuid",
    "full_name": "string",
    "phone_number": "string",
    "photo_media_id": "uuid",
    "is_active": boolean
  }
  ```
- **Response**: Returns updated AdminResponse object

### Delete Admin
- **DELETE** `/admin/:id`
- **Description**: Deletes an admin account
- **Access**: Limited by role and location
- **Response**: Success message

### Get Profile
- **GET** `/admin/profile`
- **Description**: Retrieves the current admin's profile
- **Response**: Returns AdminResponse object for the current user

## Access Control Rules

1. **Super Admin**:
   - Can manage all admins
   - Can create/modify other super admins
   - Has access to all countries and cities

2. **Regular Admins**:
   - Cannot manage super admins
   - Can only manage admins in their assigned country
   - If city-specific, can only manage admins in their city
   - Cannot change country assignments
   - Cannot create super admins

3. **General Rules**:
   - Admins cannot delete their own account
   - Username must be unique
   - Profile photos must belong to the same country as the admin
   - Password is always hashed before storage
   - Inactive admins cannot login 