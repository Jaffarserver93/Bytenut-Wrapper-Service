import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authV1Router from "./v1/auth.js";
import userV1Router from "./v1/user.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/v1/auth", authV1Router);
router.use("/v1/user", userV1Router);

export default router;
