// const Group = require("../models/Group");
// const Member = require("../models/Member");

// // Create Group
// exports.createGroup = async (req, res) => {
//     try {

//         const { groupName } = req.body;

//         const existingGroup = await Group.findOne({ groupName });

//         if (existingGroup) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Group already exists"
//             });
//         }

//         const group = await Group.create({
//             groupName,
//             createdBy: req.admin.id
//         });

//         res.status(201).json({
//             success: true,
//             message: "Group created successfully",
//             group
//         });

//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

// // Get All Groups
// exports.getGroups = async (req, res) => {
//     try {

//         const groups = await Group.find()
//             .populate("members", "name email phone");

//         res.status(200).json({
//             success: true,
//             groups
//         });

//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

// // Add Member To Group
// exports.addMemberToGroup = async (req, res) => {

//     try {

//         const { groupId, memberId } = req.body;

//         const group = await Group.findById(groupId);

//         const member = await Member.findById(memberId);

//         if (!group || !member) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Group or Member not found"
//             });
//         }

//         if (!group.members.includes(memberId)) {
//             group.members.push(memberId);
//         }

//         member.group = groupId;

//         await group.save();

//         await member.save();

//         res.json({
//             success: true,
//             message: "Member added successfully"
//         });

//     } catch (error) {

//         res.status(500).json({
//             success: false,
//             message: error.message
//         });

//     }
// };

// // Get Members of One Group
// exports.getGroupMembers = async (req, res) => {

//     try {

//         const group = await Group.findById(req.params.id)
//             .populate("members", "name email phone");

//         if (!group) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Group not found"
//             });
//         }

//         res.json({
//             success: true,
//             groupName: group.groupName,
//             members: group.members
//         });

//     } catch (error) {

//         res.status(500).json({
//             success: false,
//             message: error.message
//         });

//     }
// };