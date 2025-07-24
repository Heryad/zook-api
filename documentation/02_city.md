# City API Documentation

## Overview
The City API provides endpoints for managing cities and their delivery zones. Cities belong to countries and can have multiple delivery zones with specific pricing. The API supports role-based access control where super admins have full access while other admins are restricted to their assigned locations.

## Authentication
All city endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Endpoints

### Get Cities
- **GET** `/cities`
- **Description**: Retrieves a paginated list of cities
- **Query Parameters**:
  - search?: string (search by name)
  - country_id?: string
  - is_active?: boolean
  - page?: number (default: 1)
  - limit?: number (default: 10)
  - sort_by?: 'name' | 'created_at'
  - sort_order?: 'asc' | 'desc'
- **Response**:
  ```json
  {
    "success": true,
    "message": "Cities retrieved successfully",
    "data": {
      "cities": [{
        "id": "uuid",
        "country_id": "uuid",
        "country_name": "string",
        "name": "string",
        "zones": [{
          "id": "uuid",
          "name": "string",
          "latitude": number,
          "longitude": number,
          "delivery_price": number
        }],
        "is_active": boolean,
        "created_at": "datetime"
      }],
      "total": number,
      "page": number,
      "limit": number,
      "totalPages": number
    }
  }
  ```

### Create City
- **POST** `/cities`
- **Description**: Creates a new city
- **Access**: Limited by role and location
- **Request Body**:
  ```json
  {
    "country_id": "uuid",
    "name": "string",
    "zones": [{
      "name": "string",
      "latitude": number,
      "longitude": number,
      "delivery_price": number
    }]
  }
  ```
- **Response**: Returns created CityResponse object

### Update City
- **PUT** `/cities/:id`
- **Description**: Updates an existing city
- **Access**: Limited by role and location
- **Request Body**:
  ```json
  {
    "name": "string",
    "is_active": boolean
  }
  ```
- **Response**: Returns updated CityResponse object

### Delete City
- **DELETE** `/cities/:id`
- **Description**: Deletes a city
- **Access**: Limited by role and location
- **Response**: Success message

## Zone Management

### Get Zones
- **GET** `/cities/:cityId/zones`
- **Description**: Retrieves all zones for a specific city
- **Response**: Array of Zone objects

### Add Zone
- **POST** `/cities/:cityId/zones`
- **Description**: Adds a new delivery zone to a city
- **Request Body**:
  ```json
  {
    "name": "string",
    "latitude": number,
    "longitude": number,
    "delivery_price": number
  }
  ```
- **Response**: Returns created Zone object

### Update Zone
- **PUT** `/cities/:cityId/zones/:zoneId`
- **Description**: Updates an existing zone
- **Request Body**: All fields are optional
  ```json
  {
    "name": "string",
    "latitude": number,
    "longitude": number,
    "delivery_price": number
  }
  ```
- **Response**: Returns updated Zone object

### Delete Zone
- **DELETE** `/cities/:cityId/zones/:zoneId`
- **Description**: Deletes a zone from a city
- **Response**: Success message

## Access Control Rules

1. **Super Admin**:
   - Can manage all cities and their zones
   - Has access to all countries
   - Can create, update, and delete any city or zone

2. **Regular Admins**:
   - Can only manage cities in their assigned country
   - City-specific admins can only manage their assigned city
   - Cannot create or modify cities in different countries

3. **General Rules**:
   - City names must be unique within a country
   - Zone names must be unique within a city
   - Latitude must be between -90 and 90
   - Longitude must be between -180 and 180
   - Delivery prices must be positive numbers
   - Zone names must be at least 2 characters long

## Data Validation

1. **Zone Validation**:
   - Name: minimum 2 characters
   - Latitude: -90 to 90
   - Longitude: -180 to 180
   - Delivery Price: positive number

2. **City Validation**:
   - Name: required, unique within country
   - Country ID: required, must exist
   - Zones: optional array of valid zone objects 