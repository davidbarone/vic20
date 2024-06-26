const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  entry: { vic20_main: path.resolve("./src/index.ts") },
  devtool: "inline-source-map",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name]-bundle.js",
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./html/index.html",
      filename: "vic20.html",
    }),
  ],
  devServer: {
    contentBase: "./dist",
    hot: true,
  },
};
