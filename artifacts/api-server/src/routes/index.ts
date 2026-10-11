import { Router, type IRouter } from "express";
import healthRouter from "./health";
import vendorLockRouter from "./vendorlock";

const router: IRouter = Router();

router.use(healthRouter);
router.use(vendorLockRouter);

export default router;
