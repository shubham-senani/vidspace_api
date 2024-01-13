import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();
        // console.log(accessToken,":::::::::::", refreshToken);
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "something went wrong while generating refresh and access token");
    }
}

export const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    const { username, email, fullname, password } = req.body;

    // validation - not empty
    if (
        [username, email, fullname, password].some((item) => item === undefined || item.trim() === "")
    ) {
        throw new ApiError(400, "provide valid inputs")
    }

    // check if user already exists: username, email
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    });
    if (existedUser) {
        throw new ApiError(409, "User Already Exist");
    }

    // check for images, check for avatar
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    // upload them to cloudinary, avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!avatar) {
        throw new ApiError(400, "Avatar file is required");
    }

    // create user object - create entry in db
    const user = await User.create({
        fullname,
        username: username.toLowerCase(),
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password
    });

    // check for user creation
    // remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering user")
    }

    // return res
    res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    );
});

export const loginUser = asyncHandler(async (req, res) => {
    //req body --> data
    // validate username or email
    // find the user
    // password check
    // generate access and refresh token
    //send cookie
    // return response data

    const { email, username, password } = req.body;

    if (!(username || email)) {
        throw new ApiError(400, "username or email is required");
    }

    const user = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (!user) {
        throw new ApiError(404, "User does not exist");
    };

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials");
    };

    const { refreshToken, accessToken } = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true
    }

    res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User logged In Successfully"
            )
        )

});

export const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    );

    const options = {
        httpOnly: true,
        secure: true
    }

    res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged out"))
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }
    const decodedToken = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
        throw new ApiError(401, "Invalid refresh token");
    };

    if (incomingRefreshToken !== user?.refreshToken) {
        throw new ApiError(401, "Refresh token is expired or used");
    };

    const { refreshToken, accessToken } = await generateAccessAndRefreshTokens(user._id);

    const options = {
        httpOnly: true,
        secure: true
    };

    res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    accessToken, refreshToken
                },
                "Access token refreshed"
            )
        )



})