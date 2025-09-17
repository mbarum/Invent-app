



import { Router, Request, Response, NextFunction } from 'express';
import { GoogleGenAI, Type } from "@google/genai";
import { isAuthenticated, hasPermission } from '../middleware/authMiddleware';
import { PERMISSIONS } from '../config/permissions';
import db from '../db';
import { auditLog } from '../services/auditService';

const router = Router();

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

// FIX: Explicitly typed handler parameters to resolve type mismatch.
const vinSearch = async (req: Request, res: Response, next: NextFunction) => {
    const { vin } = req.body;
    if (!vin) {
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
        if (response.text) {
             try {
                results = JSON.parse(response.text);
             } catch (e) {
                console.error("Failed to parse Gemini response:", e);
                throw new Error("AI returned an invalid response format.");
             }
        }
        
        await auditLog(req.user!.id, 'VIN_SEARCH', { vin, resultsCount: results.length });

        res.status(200).json(results);

    } catch (error) {
        console.error('Gemini API Error:', error);
        next(new Error('Failed to process VIN search with AI.'));
    }
};

router.post('/', isAuthenticated, hasPermission(PERMISSIONS.USE_VIN_PICKER), vinSearch);

export default router;