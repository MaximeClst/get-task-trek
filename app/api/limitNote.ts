import handler from "@/lib/createNote";
import { NextApiRequest, NextApiResponse } from "next";

export default (req: NextApiRequest, res: NextApiResponse) => {
  return handler(req, res);
};
