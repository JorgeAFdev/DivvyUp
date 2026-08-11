import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import type { JwtPayload } from '../types/express.js';

const jwtMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers["authorization"];
  
    
    if (!authHeader) return res.status(401).json({error: "Unauthorized MISSING HEADER"});
    const token = authHeader.split(" ")[1];
    // Si no hubiera token, respondemos con un 401
    if (!token) return res.status(401).json({error: "Unauthorized"});
  
    let tokenPayload;
  
    try {
      
      tokenPayload = jwt.verify(token, process.env.jwt_secret as string);

    } catch (error) {
      return res.status(401).json({error: "Unauthorized"});
    }

    // Guardamos los datos del token dentro de req.jwtPayload
    req.jwtPayload = tokenPayload as JwtPayload;
    next();
  };
  


export { jwtMiddleware };