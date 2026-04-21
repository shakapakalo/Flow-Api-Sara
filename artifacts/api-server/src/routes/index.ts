import { Router, type IRouter } from "express";
import healthRouter from "./health";
import flowProxyRouter from "./flow-proxy";
import authRouter from "./auth";
import adminRouter from "./admin";
import flow2apiAdminProxy from "./flow2api-admin-proxy";
import proxyDownloadRouter from "./proxy-download";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(flowProxyRouter);
router.use(flow2apiAdminProxy);
router.use(proxyDownloadRouter);

export default router;
