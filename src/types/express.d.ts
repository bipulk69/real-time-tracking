import { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      
      userData?: {
        userId: number;
        email: string;
        role: UserRole;
        name?: string;
      };

     
      googleData?: {
        googleId: string;
        email: string;
        name: string;
        picture?: string;
      };

      twitterData?: {
        twitterId: string;
        username: string;
        name: string;
        profileImageUrl?: string;
      };

      facebookData?: {
        facebookId: string;
        email: string;
        name: string;
        picture?: string;
      };

     
      resetPasswordData?: {
        resetToken: string;
        resetTokenExpiry: Date;
      };

   
      file?: {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        destination: string;
        filename: string;
        path: string;
        size: number;
      };

      
      apiKey?: string;
      clientId?: string;

     
      startTime?: number;
      endTime?: number;

      
      paginationData?: {
        page: number;
        limit: number;
        totalItems: number;
        totalPages: number;
      };

      
      language?: string;

      
      deviceInfo?: {
        type: 'mobile' | 'tablet' | 'desktop';
        os: string;
        browser: string;
      };

      
      geoip?: {
        ip: string;
        country: string;
        city?: string;
        latitude?: number;
        longitude?: number;
      };

 
      rateLimit?: {
        limit: number;
        current: number;
        remaining: number;
        resetTime: Date;
      };
    }
  }
}


export {};