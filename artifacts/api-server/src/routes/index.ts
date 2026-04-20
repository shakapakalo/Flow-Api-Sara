import { Router, type IRouter } from "express";
import healthRouter from "./health";
import flowProxyRouter from "./flow-proxy";
import authRouter from "./auth";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(flowProxyRouter);

export default router;
