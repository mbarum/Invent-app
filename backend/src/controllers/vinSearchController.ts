// FIX: Add 'import "express-session"' to ensure the Express Request type is correctly augmented with session properties.
import 'express-session';
// FIX: Replaced multiple/inconsistent express imports with a single import for express and its types to resolve type conflicts.
import express, { Request, Response, NextFunction, Router } from 'express';
import { GoogleGenAI, Type } from "@google/genai";
import { isAuthenticated, hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';
import db from '../db';
import { auditLog } from '../services/auditService';


const router = Router();

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

// FIX: Use specific Request, Response, and NextFunction types from the default express import to resolve property access errors.
const vinSearch = async (req: Request, res: Response, next: NextFunction) => {
    // FIX: Correctly access req.body by using the full express.Request type.
    const { vin } = req.body;
    if (!vin) {
        // FIX: Correctly access res.status by using the full express.Response type.
        return res.status(400).json({ message: 'VIN is required.' });
    }

    try {
        // 1. Fetch all products from the database
        const inventory = await db('products').select('partNumber', 'name', 'stock');

        // 2. Construct the prompt for the Gemini API
        const inventoryString = inventory.map(p => `- Part Number: ${p.partNumber}, Name: ${p.name}, Stock: ${p.stock}`).join('\n');
        
        const prompt = `
            Given the following inventory of car parts:
            ${inventoryString}

            Analyze this Vehicle Identification Number (VIN): "${vin}".
            
            Based on the VIN, determine the vehicle's make, model, and year. 
            Then, identify which parts from the inventory list are compatible with this vehicle.
            
            Provide a response ONLY in the specified JSON format. For each compatible part, briefly explain the reason for compatibility. If no parts are compatible, return an empty array.
        `;

        // 3. Define the response schema
        const responseSchema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    partNumber: { type: Type.STRING },
                    name: { type: Type.STRING },
                    compatibility: { type: Type.STRING, description: 'A brief reason for compatibility.' },
                    stock: { type: Type.INTEGER }
                },
                required: ['partNumber', 'name', 'compatibility', 'stock'],
            },
        };

        // 4. Call the Gemini API
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });
        
        // 5. Parse and return the response
        let results = [];
        // FIX: Use response.text to get the JSON string directly, as per Gemini API guidelines.
        if (response.text) {
             try {
                results = JSON.parse(response.text.trim());
             } catch (e) {
                console.error("Failed to parse Gemini response:", e);
                throw new Error("AI returned an invalid response format.");
             }
        }
        
        // FIX: Correctly access req.user by using the full express.Request type.
        await auditLog(req.user!.id, 'VIN_SEARCH', { vin, resultsCount: results.length });

        // FIX: Correctly access res.status by using the full express.Response type.
        res.status(200).json(results);

    } catch (error) {
        console.error('Gemini API Error:', error);
        next(new Error('Failed to process VIN search with AI.'));
    }
};

// Use the explicitly typed handlers with the router
router.post('/', isAuthenticated, hasPermission(PERMISSIONS.USE_VIN_PICKER), vinSearch);

export default router;