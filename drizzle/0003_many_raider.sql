CREATE TABLE `feePayers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`studentId` varchar(30) NOT NULL,
	`department` varchar(100),
	`phone` varchar(30),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `feePayers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rentals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payerId` int NOT NULL,
	`itemId` int NOT NULL,
	`itemNumber` int NOT NULL,
	`collateralType` varchar(50) NOT NULL,
	`collateralDetail` varchar(100),
	`note` text,
	`rentedAt` timestamp NOT NULL DEFAULT (now()),
	`dueDate` timestamp NOT NULL,
	`returnedAt` timestamp,
	`status` enum('borrowed','returned','overdue') NOT NULL DEFAULT 'borrowed',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rentals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `members` ADD `approvalStatus` enum('pending','approved','rejected') DEFAULT 'approved' NOT NULL;