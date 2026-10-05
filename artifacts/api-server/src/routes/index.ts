import { Router, type IRouter } from "express";
import accountAndAdminRouter from "./account-and-admin";
import authRouter from "./auth";
import healthRouter from "./health";
import problemsRouter from "./problems";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(problemsRouter);
router.use(accountAndAdminRouter);

export default router;
