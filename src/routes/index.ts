import { Router, Request, Response } from "express";
import produtoRoute from "./produtoRoute";

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.send('API Plataforma Cursos está operacional!');
});

router.use('/produtos', produtoRoute);

export default router;