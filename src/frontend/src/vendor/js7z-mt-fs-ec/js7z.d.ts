// TypeScript bindings for emscripten-generated code.  Automatically generated at compile time.
declare namespace RuntimeExports {
	let callMain: any;
	namespace FS {
		export let root: any;
		export let mounts: any[];
		export let devices: {};
		export let streams: any[];
		export let nextInode: number;
		export let nameTable: any;
		export let currentPath: string;
		export let initialized: boolean;
		export let ignorePermissions: boolean;
		export let filesystems: any;
		export let syncFSRequests: number;
		export let readFiles: {};
		export { ErrnoError };
		export { FSStream };
		export { FSNode };
		export function lookupPath(
			path: any,
			opts?: {}
		):
			| {
					path: string;
					node?: undefined;
			  }
			| {
					path: string;
					node: any;
			  };
		export function getPath(node: any): any;
		export function hashName(parentid: any, name: any): number;
		export function hashAddNode(node: any): void;
		export function hashRemoveNode(node: any): void;
		export function lookupNode(parent: any, name: any): any;
		export function createNode(parent: any, name: any, mode: any, rdev: any): any;
		export function destroyNode(node: any): void;
		export function isRoot(node: any): boolean;
		export function isMountpoint(node: any): boolean;
		export function isFile(mode: any): boolean;
		export function isDir(mode: any): boolean;
		export function isLink(mode: any): boolean;
		export function isChrdev(mode: any): boolean;
		export function isBlkdev(mode: any): boolean;
		export function isFIFO(mode: any): boolean;
		export function isSocket(mode: any): boolean;
		export function flagsToPermissionString(flag: any): string;
		export function nodePermissions(node: any, perms: any): 0 | 2;
		export function mayLookup(dir: any): any;
		export function mayCreate(dir: any, name: any): any;
		export function mayDelete(dir: any, name: any, isdir: any): any;
		export function mayOpen(node: any, flags: any): any;
		export function checkOpExists(op: any, err: any): any;
		export let MAX_OPEN_FDS: number;
		export function nextfd(): number;
		export function getStreamChecked(fd: any): any;
		export function getStream(fd: any): any;
		export function createStream(stream: any, fd?: number): any;
		export function closeStream(fd: any): void;
		export function dupStream(origStream: any, fd?: number): any;
		export function doSetAttr(stream: any, node: any, attr: any): void;
		export namespace chrdev_stream_ops {
			function open(stream: any): void;
			function llseek(): never;
		}
		export function major(dev: any): number;
		export function minor(dev: any): number;
		export function makedev(ma: any, mi: any): number;
		export function registerDevice(dev: any, ops: any): void;
		export function getDevice(dev: any): any;
		export function getMounts(mount: any): any[];
		export function syncfs(populate: any, callback: any): void;
		export function mount(type: any, opts: any, mountpoint: any): any;
		export function unmount(mountpoint: any): void;
		export function lookup(parent: any, name: any): any;
		export function mknod(path: any, mode: any, dev: any): any;
		export function statfs(path: any): any;
		export function statfsStream(stream: any): any;
		export function statfsNode(node: any): {
			bsize: number;
			frsize: number;
			blocks: number;
			bfree: number;
			bavail: number;
			files: any;
			ffree: number;
			fsid: number;
			flags: number;
			namelen: number;
		};
		export function create(path: any, mode?: number): any;
		export function mkdir(path: any, mode?: number): any;
		export function mkdirTree(path: any, mode: any): void;
		export function mkdev(path: any, mode: any, dev: any): any;
		export function symlink(oldpath: any, newpath: any): any;
		export function rename(old_path: any, new_path: any): void;
		export function rmdir(path: any): void;
		export function readdir(path: any): any;
		export function unlink(path: any): void;
		export function readlink(path: any): any;
		export function stat(path: any, dontFollow: any): any;
		export function fstat(fd: any): any;
		export function lstat(path: any): any;
		export function doChmod(stream: any, node: any, mode: any, dontFollow: any): void;
		export function chmod(path: any, mode: any, dontFollow: any): void;
		export function lchmod(path: any, mode: any): void;
		export function fchmod(fd: any, mode: any): void;
		export function doChown(stream: any, node: any, dontFollow: any): void;
		export function chown(path: any, uid: any, gid: any, dontFollow: any): void;
		export function lchown(path: any, uid: any, gid: any): void;
		export function fchown(fd: any, uid: any, gid: any): void;
		export function doTruncate(stream: any, node: any, len: any): void;
		export function truncate(path: any, len: any): void;
		export function ftruncate(fd: any, len: any): void;
		export function utime(path: any, atime: any, mtime: any): void;
		export function open(path: any, flags: any, mode?: number): any;
		export function close(stream: any): void;
		export function isClosed(stream: any): boolean;
		export function llseek(stream: any, offset: any, whence: any): any;
		export function read(stream: any, buffer: any, offset: any, length: any, position: any): any;
		export function write(
			stream: any,
			buffer: any,
			offset: any,
			length: any,
			position: any,
			canOwn: any
		): any;
		export function mmap(stream: any, length: any, position: any, prot: any, flags: any): any;
		export function msync(stream: any, buffer: any, offset: any, length: any, mmapFlags: any): any;
		export function ioctl(stream: any, cmd: any, arg: any): any;
		export function readFile(path: any, opts?: {}): Uint8Array<any>;
		export function writeFile(path: any, data: any, opts?: {}): void;
		export function cwd(): any;
		export function chdir(path: any): void;
		export function createDefaultDirectories(): void;
		export function createDefaultDevices(): void;
		export function createSpecialDirectories(): void;
		export function createStandardStreams(input: any, output: any, error: any): void;
		export function staticInit(): void;
		export function init(input: any, output: any, error: any): void;
		export function quit(): void;
		export function findObject(path: any, dontResolveLastLink: any): any;
		export function analyzePath(
			path: any,
			dontResolveLastLink: any
		): {
			isRoot: boolean;
			exists: boolean;
			error: number;
			name: any;
			path: any;
			object: any;
			parentExists: boolean;
			parentPath: any;
			parentObject: any;
		};
		export function createPath(parent: any, path: any, canRead: any, canWrite: any): any;
		export function createFile(
			parent: any,
			name: any,
			properties: any,
			canRead: any,
			canWrite: any
		): any;
		export function createDataFile(
			parent: any,
			name: any,
			data: any,
			canRead: any,
			canWrite: any,
			canOwn: any
		): void;
		export function createDevice(parent: any, name: any, input: any, output: any): any;
		export function forceLoadFile(obj: any): boolean;
		export function createLazyFile(
			parent: any,
			name: any,
			url: any,
			canRead: any,
			canWrite: any
		): any;
	}
	namespace NODEFS {
		let isWindows: boolean;
		function staticInit(): void;
		function convertNodeCode(e: any): any;
		function tryFSOperation(f: any): any;
		function mount(mount: any): any;
		function createNode(parent: any, name: any, mode: any, dev: any): any;
		function getMode(path: any): any;
		function realPath(node: any): any;
		function flagsForNode(flags: any): number;
		function getattr(
			func: any,
			node: any
		): {
			dev: any;
			ino: any;
			mode: any;
			nlink: any;
			uid: any;
			gid: any;
			rdev: any;
			size: any;
			atime: any;
			mtime: any;
			ctime: any;
			blksize: any;
			blocks: any;
		};
		function setattr(
			arg: any,
			node: any,
			attr: any,
			chmod: any,
			utimes: any,
			truncate: any,
			stat: any
		): void;
		namespace node_ops {
			function getattr(node: any): any;
			function setattr(node: any, attr: any): void;
			function lookup(parent: any, name: any): any;
			function mknod(parent: any, name: any, mode: any, dev: any): any;
			function rename(oldNode: any, newDir: any, newName: any): void;
			function unlink(parent: any, name: any): void;
			function rmdir(parent: any, name: any): void;
			function readdir(node: any): any;
			function symlink(parent: any, newName: any, oldPath: any): void;
			function readlink(node: any): any;
			function statfs(path: any): any;
		}
		namespace stream_ops {
			function getattr(stream: any): any;
			function setattr(stream: any, attr: any): void;
			function open(stream: any): void;
			function close(stream: any): void;
			function dup(stream: any): void;
			function read(stream: any, buffer: any, offset: any, length: any, position: any): any;
			function write(stream: any, buffer: any, offset: any, length: any, position: any): any;
			function llseek(stream: any, offset: any, whence: any): any;
			function mmap(
				stream: any,
				length: any,
				position: any,
				prot: any,
				flags: any
			): {
				ptr: any;
				allocated: boolean;
			};
			function msync(stream: any, buffer: any, offset: any, length: any, mmapFlags: any): number;
		}
	}
	namespace WORKERFS {
		export let DIR_MODE: number;
		export let FILE_MODE: number;
		export let reader: any;
		export function mount(mount: any): any;
		export function createNode(
			parent: any,
			name: any,
			mode: any,
			dev: any,
			contents: any,
			mtime: any
		): any;
		export namespace node_ops_1 {
			function getattr(node: any): {
				dev: number;
				ino: any;
				mode: any;
				nlink: number;
				uid: number;
				gid: number;
				rdev: number;
				size: any;
				atime: Date;
				mtime: Date;
				ctime: Date;
				blksize: number;
				blocks: number;
			};
			function setattr(node: any, attr: any): void;
			function lookup(parent: any, name: any): never;
			function mknod(parent: any, name: any, mode: any, dev: any): never;
			function rename(oldNode: any, newDir: any, newName: any): never;
			function unlink(parent: any, name: any): never;
			function rmdir(parent: any, name: any): never;
			function readdir(node: any): string[];
			function symlink(parent: any, newName: any, oldPath: any): never;
		}
		export { node_ops_1 as node_ops };
		export namespace stream_ops_1 {
			function read(stream: any, buffer: any, offset: any, length: any, position: any): any;
			function write(stream: any, buffer: any, offset: any, length: any, position: any): never;
			function llseek(stream: any, offset: any, whence: any): any;
		}
		export { stream_ops_1 as stream_ops };
	}
	namespace PROXYFS {
		export function mount(mount: any): any;
		export function createNode(parent: any, name: any, mode: any, dev: any): any;
		export function realPath(node: any): any;
		export namespace node_ops_2 {
			function getattr(node: any): {
				dev: any;
				ino: any;
				mode: any;
				nlink: any;
				uid: any;
				gid: any;
				rdev: any;
				size: any;
				atime: any;
				mtime: any;
				ctime: any;
				blksize: any;
				blocks: any;
			};
			function setattr(node: any, attr: any): void;
			function lookup(parent: any, name: any): any;
			function mknod(parent: any, name: any, mode: any, dev: any): any;
			function rename(oldNode: any, newDir: any, newName: any): void;
			function unlink(parent: any, name: any): void;
			function rmdir(parent: any, name: any): void;
			function readdir(node: any): any;
			function symlink(parent: any, newName: any, oldPath: any): void;
			function readlink(node: any): any;
		}
		export { node_ops_2 as node_ops };
		export namespace stream_ops_2 {
			function open(stream: any): void;
			function close(stream: any): void;
			function read(stream: any, buffer: any, offset: any, length: any, position: any): any;
			function write(stream: any, buffer: any, offset: any, length: any, position: any): any;
			function llseek(stream: any, offset: any, whence: any): any;
		}
		export { stream_ops_2 as stream_ops };
	}
}
declare class ErrnoError {
	constructor(errno: any);
	name: string;
	errno: any;
}
declare class FSStream {
	shared: {};
	set object(val: any);
	get object(): any;
	node: any;
	get isRead(): boolean;
	get isWrite(): boolean;
	get isAppend(): number;
	set flags(val: any);
	get flags(): any;
	set position(val: any);
	get position(): any;
}
declare class FSNode {
	constructor(parent: any, name: any, mode: any, rdev: any);
	node_ops: {};
	stream_ops: {};
	readMode: number;
	writeMode: number;
	mounted: any;
	parent: any;
	mount: any;
	id: number;
	name: any;
	mode: any;
	rdev: any;
	atime: number;
	mtime: number;
	ctime: number;
	set read(val: boolean);
	get read(): boolean;
	set write(val: boolean);
	get write(): boolean;
	get isFolder(): any;
	get isDevice(): any;
}
interface WasmModule {
	_main(_0: number, _1: number): number;
	__emscripten_proxy_main(_0: number, _1: number): number;
}

export type MainModule = WasmModule & typeof RuntimeExports;
export default function MainModuleFactory(options?: unknown): Promise<MainModule>;
