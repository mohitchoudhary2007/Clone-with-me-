import { Router, type IRouter } from "express";
import healthRouter from "./health";
import generatePromptRouter from "./generate-prompt";

const router: IRouter = Router();

router.use(healthRouter);
router.use(generatePromptRouter);

export default router;
