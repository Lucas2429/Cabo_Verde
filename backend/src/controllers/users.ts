import bcrypt from "bcrypt";
import express from "express";
import User, { DEFAULT_DEPARTMENT, DEPARTMENTS } from "../models/user";

const router = express.Router();

router.post("/", async (request, response) => {
  const { username, email, password, department } = request.body;

  if (!username || username.length < 3) {
    response.status(400).json({
      error: "username must be at least 3 characters long",
    });
    return;
  }

  if (!password || password.length < 3) {
    response.status(400).json({
      error: "password must be at least 3 characters long",
    });
    return;
  }

  if (
    department !== undefined &&
    !(DEPARTMENTS as readonly string[]).includes(department)
  ) {
    response.status(400).json({
      error: `department must be one of: ${DEPARTMENTS.join(", ")}`,
    });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = new User({
    username,
    email,
    passwordHash,
    department: department ?? DEFAULT_DEPARTMENT,
  });
  const savedUser = await user.save();

  response.status(201).json(savedUser);
});

router.get("/", async (request, response) => {
  const users = await User.find({});
  response.json(users);
});

export default router;
