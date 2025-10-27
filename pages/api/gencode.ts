import { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  //random 6 digits
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  return res.status(200).json({ gencode: code });
}
