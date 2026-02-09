-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1:3307
-- Tiempo de generación: 09-02-2026 a las 02:38:32
-- Versión del servidor: 8.0.44
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `proyecto_29797`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `auditoria`
--

CREATE TABLE `auditoria` (
  `id` int NOT NULL,
  `fecha` datetime NOT NULL,
  `usuario` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `usuario_id` int DEFAULT NULL,
  `ip` varchar(45) COLLATE utf8mb4_general_ci NOT NULL,
  `accion` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `tabla` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `registro_id` int DEFAULT NULL,
  `descripcion` varchar(255) COLLATE utf8mb4_general_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `auditoria`
--

INSERT INTO `auditoria` (`id`, `fecha`, `usuario`, `usuario_id`, `ip`, `accion`, `tabla`, `registro_id`, `descripcion`) VALUES
(1, '2026-02-02 16:14:16', 'administrador', 3, '::1', 'usuarios_create', 'usuarios', 4, 'creó usuario juan'),
(2, '2026-02-03 15:14:41', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(3, '2026-02-03 15:14:45', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(4, '2026-02-03 15:23:01', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(5, '2026-02-03 15:25:50', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(6, '2026-02-03 15:26:07', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(7, '2026-02-03 15:26:28', 'administrador', 3, '::1', 'usuarios_delete', 'usuarios', 4, 'desactivó usuario 4'),
(8, '2026-02-03 15:26:36', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(9, '2026-02-03 15:26:46', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(10, '2026-02-03 16:17:45', 'admin@espe.edu.ec', NULL, '::1', 'login_fail', 'usuarios', NULL, 'usuario inexistente'),
(11, '2026-02-03 16:17:48', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(12, '2026-02-03 16:18:11', 'administrador', 3, '::1', 'roles_create', 'roles', 11, 'creó rol jusn'),
(13, '2026-02-03 16:18:19', 'administrador', 3, '::1', 'roles_update', 'roles', 11, 'editó rol 11'),
(14, '2026-02-03 16:20:44', 'administrador', 3, '::1', 'usuarios_delete', 'usuarios', 4, 'desactivó usuario 4'),
(15, '2026-02-04 01:51:16', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(16, '2026-02-04 02:17:58', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(17, '2026-02-04 02:20:04', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(18, '2026-02-04 02:20:05', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(19, '2026-02-04 02:26:24', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(20, '2026-02-04 02:28:05', 'administrador', 3, '::1', 'roles_create', 'roles', 12, 'creó rol nuevorol2'),
(21, '2026-02-04 03:33:56', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(22, '2026-02-04 03:37:28', 'administrador', 3, '::1', 'roles_update', 'roles', 12, 'editó rol 12'),
(23, '2026-02-04 03:39:59', 'administrador', 3, '::1', 'usuarios_create', 'usuarios', 5, 'creó usuario tati'),
(24, '2026-02-04 03:40:29', 'administrador', 3, '::1', 'roles_create', 'roles', 13, 'creó rol pruebaderol'),
(25, '2026-02-04 03:40:44', 'administrador', 3, '::1', 'usuarios_update', 'usuarios', 5, 'editó usuario 5 -> tati'),
(26, '2026-02-04 03:40:57', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 13, 'asignó 2 permiso(s) al rol 13'),
(27, '2026-02-04 03:40:58', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(28, '2026-02-04 03:41:06', 'tati', 5, '::1', 'login_ok', 'usuarios', 5, 'inicio de sesión'),
(29, '2026-02-04 03:41:35', 'tati', 5, '::1', 'logout', 'usuarios', 5, 'cierre de sesión'),
(30, '2026-02-04 03:41:37', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(31, '2026-02-04 03:41:51', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 13, 'asignó 3 permiso(s) al rol 13'),
(32, '2026-02-04 03:41:52', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(33, '2026-02-04 03:41:57', 'tati', 5, '::1', 'login_ok', 'usuarios', 5, 'inicio de sesión'),
(34, '2026-02-04 03:46:43', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(35, '2026-02-04 03:46:54', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 13, 'asignó 8 permiso(s) al rol 13'),
(36, '2026-02-04 03:46:56', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(37, '2026-02-04 03:47:00', 'tati', 5, '::1', 'login_ok', 'usuarios', 5, 'inicio de sesión'),
(38, '2026-02-04 03:47:28', 'tati', 5, '::1', 'usuarios_delete', 'usuarios', 3, 'desactivó usuario 3'),
(39, '2026-02-04 03:47:40', 'tati', 5, '::1', 'usuarios_update', 'usuarios', 3, 'editó usuario 3 -> administrador'),
(40, '2026-02-04 03:49:27', 'tati', 5, '::1', 'logout', 'usuarios', 5, 'cierre de sesión'),
(41, '2026-02-04 03:49:29', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(42, '2026-02-04 03:49:36', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(43, '2026-02-04 03:49:39', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(44, '2026-02-04 03:49:40', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(45, '2026-02-04 03:49:48', 'tati', 5, '::1', 'login_ok', 'usuarios', 5, 'inicio de sesión'),
(46, '2026-02-04 03:50:52', 'tati', 5, '::1', 'usuarios_delete', 'usuarios', 3, 'desactivó usuario 3'),
(47, '2026-02-04 03:50:59', 'tati', 5, '::1', 'usuarios_update', 'usuarios', 3, 'editó usuario 3 -> administrador'),
(48, '2026-02-04 03:59:02', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(49, '2026-02-04 03:59:16', 'administrador', 3, '::1', 'usuarios_update', 'usuarios', 3, 'editó usuario 3 -> administrador (cambio rol)'),
(50, '2026-02-04 03:59:23', 'administrador', 3, '::1', 'usuarios_update', 'usuarios', 5, 'editó usuario 5 -> tati (cambio rol)'),
(51, '2026-02-04 03:59:58', 'administrador', 3, '::1', 'usuarios_create', 'usuarios', 6, 'creó usuario pepe'),
(52, '2026-02-04 04:00:00', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(53, '2026-02-04 04:00:06', 'pepe', 6, '::1', 'login_ok', 'usuarios', 6, 'inicio de sesión'),
(54, '2026-02-04 04:00:13', 'pepe', 6, '::1', 'logout', 'usuarios', 6, 'cierre de sesión'),
(55, '2026-02-04 04:00:15', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(56, '2026-02-04 04:00:42', 'administrador', 3, '::1', 'usuarios_update', 'usuarios', 6, 'editó usuario 6 -> pepe (cambio rol)'),
(57, '2026-02-04 04:00:56', 'administrador', 3, '::1', 'usuarios_update', 'usuarios', 5, 'editó usuario 5 -> tati (cambio rol)'),
(58, '2026-02-04 04:01:02', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(59, '2026-02-04 04:01:06', 'pepe', 6, '::1', 'login_ok', 'usuarios', 6, 'inicio de sesión'),
(60, '2026-02-04 04:01:10', 'pepe', 6, '::1', 'logout', 'usuarios', 6, 'cierre de sesión'),
(61, '2026-02-04 04:01:11', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(62, '2026-02-04 04:01:32', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 12, 'asignó 2 permiso(s) al rol 12'),
(63, '2026-02-04 04:01:47', 'administrador', 3, '::1', 'usuarios_update', 'usuarios', 6, 'editó usuario 6 -> pepe (cambio rol)'),
(64, '2026-02-04 04:01:48', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(65, '2026-02-04 04:01:50', 'pepe', 6, '::1', 'login_ok', 'usuarios', 6, 'inicio de sesión'),
(66, '2026-02-04 04:02:01', 'pepe', 6, '::1', 'logout', 'usuarios', 6, 'cierre de sesión'),
(67, '2026-02-04 04:02:04', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(68, '2026-02-04 04:02:12', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 12, 'asignó 4 permiso(s) al rol 12'),
(69, '2026-02-04 04:02:17', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(70, '2026-02-04 04:02:18', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(71, '2026-02-04 04:02:20', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(72, '2026-02-04 04:02:24', 'pepe', 6, '::1', 'login_ok', 'usuarios', 6, 'inicio de sesión'),
(73, '2026-02-04 04:03:06', 'pepe', 6, '::1', 'logout', 'usuarios', 6, 'cierre de sesión'),
(74, '2026-02-04 04:03:08', 'pepe', 6, '::1', 'login_ok', 'usuarios', 6, 'inicio de sesión'),
(75, '2026-02-04 04:03:22', 'pepe', 6, '::1', 'logout', 'usuarios', 6, 'cierre de sesión'),
(76, '2026-02-04 04:03:27', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(77, '2026-02-04 04:04:54', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(78, '2026-02-04 04:04:58', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(79, '2026-02-04 05:07:34', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(80, '2026-02-04 05:07:47', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 12, 'asignó 4 permiso(s) al rol 12'),
(81, '2026-02-04 05:07:48', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(82, '2026-02-04 05:07:53', 'tati', 5, '::1', 'login_ok', 'usuarios', 5, 'inicio de sesión'),
(83, '2026-02-04 05:08:05', 'tati', 5, '::1', 'logout', 'usuarios', 5, 'cierre de sesión'),
(84, '2026-02-04 05:08:08', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(85, '2026-02-04 05:08:22', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 12, 'asignó 3 permiso(s) al rol 12'),
(86, '2026-02-04 05:08:23', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(87, '2026-02-04 05:08:28', 'tati', 5, '::1', 'login_ok', 'usuarios', 5, 'inicio de sesión'),
(88, '2026-02-04 05:08:38', 'tati', 5, '::1', 'permisos_set', 'rol_permisos', 12, 'asignó 3 permiso(s) al rol 12'),
(89, '2026-02-04 05:08:40', 'tati', 5, '::1', 'logout', 'usuarios', 5, 'cierre de sesión'),
(90, '2026-02-04 05:08:42', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(91, '2026-02-04 05:08:49', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(92, '2026-02-04 05:08:54', 'pepe', 6, '::1', 'login_ok', 'usuarios', 6, 'inicio de sesión'),
(93, '2026-02-04 05:09:04', 'pepe', 6, '::1', 'logout', 'usuarios', 6, 'cierre de sesión'),
(94, '2026-02-04 05:09:05', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(95, '2026-02-04 05:09:13', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 12, 'asignó 5 permiso(s) al rol 12'),
(96, '2026-02-04 05:09:14', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(97, '2026-02-04 05:09:17', 'pepe', 6, '::1', 'login_ok', 'usuarios', 6, 'inicio de sesión'),
(98, '2026-02-04 05:09:20', 'pepe', 6, '::1', 'logout', 'usuarios', 6, 'cierre de sesión'),
(99, '2026-02-04 05:09:21', 'pepe', 6, '::1', 'login_ok', 'usuarios', 6, 'inicio de sesión'),
(100, '2026-02-04 05:09:27', 'pepe', 6, '::1', 'logout', 'usuarios', 6, 'cierre de sesión'),
(101, '2026-02-04 05:34:21', 'pepe', 6, '::1', 'login_ok', 'usuarios', 6, 'inicio de sesión'),
(102, '2026-02-04 05:34:26', 'pepe', 6, '::1', 'logout', 'usuarios', 6, 'cierre de sesión'),
(103, '2026-02-04 05:34:28', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(104, '2026-02-04 05:47:35', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(105, '2026-02-04 05:47:38', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(106, '2026-02-04 05:47:42', 'pepe', 6, '::1', 'login_ok', 'usuarios', 6, 'inicio de sesión'),
(107, '2026-02-04 05:47:53', 'pepe', 6, '::1', 'logout', 'usuarios', 6, 'cierre de sesión'),
(108, '2026-02-04 05:47:55', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(109, '2026-02-04 05:48:04', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 12, 'asignó 2 permiso(s) al rol 12'),
(110, '2026-02-04 05:48:05', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(111, '2026-02-04 05:48:06', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(112, '2026-02-04 05:48:09', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(113, '2026-02-04 05:48:11', 'pepe', 6, '::1', 'login_ok', 'usuarios', 6, 'inicio de sesión'),
(114, '2026-02-04 12:51:56', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(115, '2026-02-04 12:52:10', 'administrador', 3, '::1', 'usuarios_delete', 'usuarios', 5, 'desactivó usuario 5'),
(116, '2026-02-04 12:52:33', 'administrador', 3, '::1', 'usuarios_update', 'usuarios', 5, 'editó usuario 5 -> tati'),
(117, '2026-02-04 12:52:42', 'administrador', 3, '::1', 'usuarios_update', 'usuarios', 5, 'editó usuario 5 -> tati'),
(118, '2026-02-04 12:52:49', 'administrador', 3, '::1', 'usuarios_update', 'usuarios', 5, 'editó usuario 5 -> tati'),
(119, '2026-02-04 18:11:07', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(120, '2026-02-04 18:11:17', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(121, '2026-02-04 18:11:20', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(122, '2026-02-04 18:11:26', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(123, '2026-02-04 18:18:29', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(124, '2026-02-04 18:19:58', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(125, '2026-02-04 18:21:09', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(126, '2026-02-04 18:21:44', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(127, '2026-02-04 18:21:54', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(128, '2026-02-04 18:25:10', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(129, '2026-02-05 17:58:12', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(130, '2026-02-05 18:05:10', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(131, '2026-02-05 18:43:51', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(132, '2026-02-06 00:09:52', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(133, '2026-02-06 00:11:09', 'administrador', 3, '::1', 'usuarios_create', 'usuarios', 7, 'creó usuario jperez'),
(134, '2026-02-06 00:11:17', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(135, '2026-02-06 00:11:26', 'jperez', 7, '::1', 'login_ok', 'usuarios', 7, 'inicio de sesión'),
(136, '2026-02-06 00:11:34', 'jperez', 7, '::1', 'logout', 'usuarios', 7, 'cierre de sesión'),
(137, '2026-02-06 00:11:36', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(138, '2026-02-06 00:11:50', 'administrador', 3, '::1', 'usuarios_update', 'usuarios', 7, 'editó usuario 7 -> jperez'),
(139, '2026-02-06 00:12:06', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 13, 'asignó 0 permiso(s) al rol 13'),
(140, '2026-02-06 00:12:13', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(141, '2026-02-06 00:12:22', 'jperez', 7, '::1', 'login_ok', 'usuarios', 7, 'inicio de sesión'),
(142, '2026-02-06 00:12:30', 'jperez', 7, '::1', 'logout', 'usuarios', 7, 'cierre de sesión'),
(143, '2026-02-06 00:12:32', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(144, '2026-02-06 00:12:56', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 13, 'asignó 1 permiso(s) al rol 13'),
(145, '2026-02-06 00:12:58', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(146, '2026-02-06 00:13:06', 'jperez', 7, '::1', 'login_ok', 'usuarios', 7, 'inicio de sesión'),
(147, '2026-02-06 00:13:30', 'jperez', 7, '::1', 'roles_create', 'roles', 14, 'creó rol crear_rol'),
(148, '2026-02-06 00:13:32', 'jperez', 7, '::1', 'logout', 'usuarios', 7, 'cierre de sesión'),
(149, '2026-02-06 00:13:33', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(150, '2026-02-06 00:15:01', 'administrador', 3, '::1', 'usuarios_create', 'usuarios', 8, 'creó usuario pedro'),
(151, '2026-02-06 00:15:08', 'administrador', 3, '::1', 'usuarios_delete', 'usuarios', 8, 'desactivó usuario 8'),
(152, '2026-02-06 00:15:11', 'administrador', 3, '::1', 'usuarios_delete', 'usuarios', 7, 'desactivó usuario 7'),
(153, '2026-02-06 00:15:14', 'administrador', 3, '::1', 'usuarios_delete', 'usuarios', 6, 'desactivó usuario 6'),
(154, '2026-02-06 00:15:16', 'administrador', 3, '::1', 'usuarios_delete', 'usuarios', 5, 'desactivó usuario 5'),
(155, '2026-02-06 00:15:34', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 14, 'asignó 2 permiso(s) al rol 14'),
(156, '2026-02-06 00:15:35', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(157, '2026-02-06 00:15:36', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(158, '2026-02-06 00:15:37', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(159, '2026-02-06 00:15:53', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(160, '2026-02-06 00:15:59', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(161, '2026-02-06 00:16:02', NULL, NULL, '::1', 'login_fail', 'usuarios', 8, 'usuario inactivo'),
(162, '2026-02-06 00:16:05', NULL, NULL, '::1', 'login_fail', 'usuarios', 8, 'usuario inactivo'),
(163, '2026-02-06 00:16:08', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(164, '2026-02-06 00:16:22', 'administrador', 3, '::1', 'usuarios_update', 'usuarios', 8, 'editó usuario 8 -> pedro'),
(165, '2026-02-06 00:16:25', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(166, '2026-02-06 00:16:30', 'pedro', 8, '::1', 'login_ok', 'usuarios', 8, 'inicio de sesión'),
(167, '2026-02-06 00:16:48', 'pedro', 8, '::1', 'logout', 'usuarios', 8, 'cierre de sesión'),
(168, '2026-02-06 00:16:50', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(169, '2026-02-06 00:16:51', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(170, '2026-02-06 00:16:53', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(171, '2026-02-06 00:47:26', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(172, '2026-02-06 00:47:36', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 14, 'asignó 4 permiso(s) al rol 14'),
(173, '2026-02-06 00:47:37', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(174, '2026-02-06 00:47:39', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(175, '2026-02-06 00:47:48', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(176, '2026-02-06 00:47:57', NULL, NULL, '::1', 'login_fail', 'usuarios', 8, 'password incorrecta, intentos=1'),
(177, '2026-02-06 00:48:01', 'pedro', 8, '::1', 'login_ok', 'usuarios', 8, 'inicio de sesión'),
(178, '2026-02-06 00:48:07', 'pedro', 8, '::1', 'usuarios_delete', 'usuarios', 3, 'desactivó usuario 3'),
(179, '2026-02-06 00:48:16', 'pedro', 8, '::1', 'usuarios_update', 'usuarios', 3, 'editó usuario 3 -> administrador'),
(180, '2026-02-06 00:54:33', 'pedro', 8, '::1', 'login_ok', 'usuarios', 8, 'inicio de sesión'),
(181, '2026-02-06 13:04:49', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(182, '2026-02-06 13:20:39', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(183, '2026-02-06 13:20:51', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 1, 'asignó 9 permiso(s) al rol 1'),
(184, '2026-02-06 13:21:06', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 1, 'asignó 10 permiso(s) al rol 1'),
(185, '2026-02-06 13:27:46', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(186, '2026-02-06 13:28:06', 'administrador', 3, '::1', 'roles_create', 'roles', 15, 'creó rol usuario'),
(187, '2026-02-06 13:28:15', 'administrador', 3, '::1', 'usuarios_update', 'usuarios', 8, 'editó usuario 8 -> pedro'),
(188, '2026-02-06 13:28:28', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(189, '2026-02-06 13:28:33', 'pedro', 8, '::1', 'login_ok', 'usuarios', 8, 'inicio de sesión'),
(190, '2026-02-06 13:28:42', 'pedro', 8, '::1', 'logout', 'usuarios', 8, 'cierre de sesión'),
(191, '2026-02-06 13:28:44', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(192, '2026-02-06 13:28:55', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 15, 'asignó 1 permiso(s) al rol 15'),
(193, '2026-02-06 13:28:56', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(194, '2026-02-06 13:29:03', 'pedro', 8, '::1', 'login_ok', 'usuarios', 8, 'inicio de sesión'),
(195, '2026-02-06 13:29:14', 'pedro', 8, '::1', 'logout', 'usuarios', 8, 'cierre de sesión'),
(196, '2026-02-06 13:29:16', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(197, '2026-02-06 13:29:23', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 15, 'asignó 1 permiso(s) al rol 15'),
(198, '2026-02-06 13:29:24', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(199, '2026-02-06 13:29:28', 'pedro', 8, '::1', 'login_ok', 'usuarios', 8, 'inicio de sesión'),
(200, '2026-02-06 13:35:44', 'pedro', 8, '::1', 'logout', 'usuarios', 8, 'cierre de sesión'),
(201, '2026-02-06 13:35:46', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(202, '2026-02-06 13:37:43', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(203, '2026-02-06 13:37:47', 'pedro', 8, '::1', 'login_ok', 'usuarios', 8, 'inicio de sesión'),
(204, '2026-02-06 13:38:30', 'pedro', 8, '::1', 'logout', 'usuarios', 8, 'cierre de sesión'),
(205, '2026-02-06 13:38:34', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(206, '2026-02-06 13:38:50', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 15, 'asignó 2 permiso(s) al rol 15'),
(207, '2026-02-06 13:38:52', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(208, '2026-02-06 13:38:54', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(209, '2026-02-06 13:39:02', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(210, '2026-02-06 13:39:03', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(211, '2026-02-06 13:39:06', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(212, '2026-02-06 13:39:11', 'pedro', 8, '::1', 'login_ok', 'usuarios', 8, 'inicio de sesión'),
(213, '2026-02-06 13:39:18', 'pedro', 8, '::1', 'logout', 'usuarios', 8, 'cierre de sesión'),
(214, '2026-02-06 13:39:25', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(215, '2026-02-06 13:39:36', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 15, 'asignó 3 permiso(s) al rol 15'),
(216, '2026-02-06 13:39:37', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(217, '2026-02-06 13:39:41', 'pedro', 8, '::1', 'login_ok', 'usuarios', 8, 'inicio de sesión'),
(218, '2026-02-06 13:40:22', 'pedro', 8, '::1', 'logout', 'usuarios', 8, 'cierre de sesión'),
(219, '2026-02-06 13:40:23', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(220, '2026-02-06 13:40:28', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 15, 'asignó 4 permiso(s) al rol 15'),
(221, '2026-02-06 13:40:29', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(222, '2026-02-06 13:40:31', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(223, '2026-02-06 13:40:35', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(224, '2026-02-06 13:40:39', 'pedro', 8, '::1', 'login_ok', 'usuarios', 8, 'inicio de sesión'),
(225, '2026-02-06 13:42:53', 'pedro', 8, '::1', 'logout', 'usuarios', 8, 'cierre de sesión'),
(226, '2026-02-06 13:42:56', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(227, '2026-02-06 13:42:58', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(228, '2026-02-06 13:43:08', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(229, '2026-02-06 13:43:14', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(230, '2026-02-06 13:43:18', NULL, NULL, '::1', 'login_fail', 'usuarios', 5, 'usuario inactivo'),
(231, '2026-02-06 13:43:25', NULL, NULL, '::1', 'login_fail', 'usuarios', 5, 'usuario inactivo'),
(232, '2026-02-06 13:53:01', NULL, NULL, '::1', 'login_fail', 'usuarios', 5, 'usuario inactivo'),
(233, '2026-02-06 13:56:09', NULL, NULL, '::1', 'login_fail', 'usuarios', 5, 'usuario inactivo'),
(234, '2026-02-06 13:56:12', NULL, NULL, '::1', 'login_fail', 'usuarios', 5, 'usuario inactivo'),
(235, '2026-02-06 13:56:17', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(236, '2026-02-06 14:57:19', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(237, '2026-02-06 16:22:05', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(238, '2026-02-06 16:39:43', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(239, '2026-02-06 16:40:23', 'administrador', 3, '::1', 'usuarios_update', 'usuarios', 5, 'editó usuario 5 -> tati'),
(240, '2026-02-06 16:40:31', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 15, 'asignó 3 permiso(s) al rol 15'),
(241, '2026-02-06 16:40:40', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(242, '2026-02-06 16:40:46', 'pedro', 8, '::1', 'login_ok', 'usuarios', 8, 'inicio de sesión'),
(243, '2026-02-06 16:41:23', 'pedro', 8, '::1', 'logout', 'usuarios', 8, 'cierre de sesión'),
(244, '2026-02-06 16:41:28', NULL, NULL, '::1', 'login_fail', 'usuarios', 5, 'usuario inactivo'),
(245, '2026-02-06 16:41:43', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(246, '2026-02-07 16:40:42', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(247, '2026-02-07 16:51:54', NULL, NULL, '::1', 'login_fail', 'usuarios', 3, 'password incorrecta, intentos=1'),
(248, '2026-02-07 16:51:54', NULL, NULL, '::1', 'login_fail', 'usuarios', 3, 'password incorrecta, intentos=2'),
(249, '2026-02-07 16:51:55', NULL, NULL, '::1', 'login_fail_block', 'usuarios', 3, 'bloqueado 5 min'),
(250, '2026-02-07 16:52:02', NULL, NULL, '::1', 'login_blocked', 'usuarios', 3, 'bloqueado, mins_left=4'),
(251, '2026-02-07 16:52:05', NULL, NULL, '::1', 'login_blocked', 'usuarios', 3, 'bloqueado, mins_left=4'),
(252, '2026-02-07 17:02:39', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(253, '2026-02-07 17:07:11', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(254, '2026-02-07 17:12:02', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(255, '2026-02-07 17:12:14', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(256, '2026-02-07 17:12:17', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(257, '2026-02-07 17:12:21', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 15, 'asignó 3 permiso(s) al rol 15'),
(258, '2026-02-07 17:16:24', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(259, '2026-02-07 17:16:58', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(260, '2026-02-07 17:22:29', NULL, NULL, '::1', 'login_fail', 'usuarios', 3, 'password incorrecta, intentos=1'),
(261, '2026-02-07 17:22:34', NULL, NULL, '::1', 'login_fail', 'usuarios', 3, 'password incorrecta, intentos=2'),
(262, '2026-02-07 17:22:34', NULL, NULL, '::1', 'login_fail_block', 'usuarios', 3, 'bloqueado 5 min'),
(263, '2026-02-07 17:22:38', NULL, NULL, '::1', 'login_blocked', 'usuarios', 3, 'bloqueado, mins_left=4'),
(264, '2026-02-07 17:23:43', NULL, NULL, '::1', 'login_blocked', 'usuarios', 3, 'bloqueado, mins_left=3'),
(265, '2026-02-07 17:25:18', NULL, NULL, '::1', 'login_blocked', 'usuarios', 3, 'bloqueado, mins_left=2'),
(266, '2026-02-07 17:25:28', NULL, NULL, '::1', 'login_fail', 'usuarios', 5, 'usuario inactivo'),
(267, '2026-02-07 17:25:34', 'pedro', 8, '::1', 'login_ok', 'usuarios', 8, 'inicio de sesión'),
(268, '2026-02-07 17:28:26', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(269, '2026-02-07 17:32:37', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(270, '2026-02-07 17:37:18', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(271, '2026-02-07 17:42:57', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(272, '2026-02-07 17:51:36', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(273, '2026-02-07 19:49:00', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(274, '2026-02-07 20:18:00', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(275, '2026-02-08 00:07:35', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(276, '2026-02-08 00:35:58', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(277, '2026-02-08 00:44:21', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(278, '2026-02-08 02:41:39', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(279, '2026-02-08 02:42:03', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(280, '2026-02-08 02:45:30', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(281, '2026-02-08 03:55:36', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(282, '2026-02-08 04:14:07', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(283, '2026-02-08 14:56:06', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(284, '2026-02-08 14:56:19', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 1, 'asignó 10 permiso(s) al rol 1'),
(285, '2026-02-08 15:36:25', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(286, '2026-02-08 15:45:13', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(287, '2026-02-08 15:46:11', 'administrador', 3, '::1', 'usuarios_update', 'usuarios', 8, 'editó usuario 8 -> pedro'),
(288, '2026-02-08 15:46:12', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(289, '2026-02-08 15:46:16', 'pedro', 8, '::1', 'login_ok', 'usuarios', 8, 'inicio de sesión'),
(290, '2026-02-08 15:46:21', 'pedro', 8, '::1', 'logout', 'usuarios', 8, 'cierre de sesión'),
(291, '2026-02-08 15:46:22', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(292, '2026-02-08 15:46:46', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 18, 'asignó 7 permiso(s) al rol 18'),
(293, '2026-02-08 15:46:48', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(294, '2026-02-08 15:46:54', 'pedro', 8, '::1', 'login_ok', 'usuarios', 8, 'inicio de sesión'),
(295, '2026-02-08 16:15:41', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(296, '2026-02-08 16:17:26', 'administrador', 3, '::1', 'usuarios_create', 'usuarios', 11, 'creó usuario secretaria'),
(297, '2026-02-08 16:18:28', 'administrador', 3, '::1', 'usuarios_create', 'usuarios', 12, 'creó usuario docente'),
(298, '2026-02-08 16:19:27', 'administrador', 3, '::1', 'roles_create', 'roles', 19, 'creó rol estudiante'),
(299, '2026-02-08 16:19:47', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 18, 'asignó 7 permiso(s) al rol 18'),
(300, '2026-02-08 16:20:10', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 19, 'asignó 3 permiso(s) al rol 19'),
(301, '2026-02-08 16:20:28', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 16, 'asignó 3 permiso(s) al rol 16'),
(302, '2026-02-08 16:20:33', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(303, '2026-02-08 16:20:37', 'secretaria', 11, '::1', 'login_ok', 'usuarios', 11, 'inicio de sesión'),
(304, '2026-02-08 16:25:38', 'secretaria', 11, '::1', 'logout', 'usuarios', 11, 'cierre de sesión'),
(305, '2026-02-08 16:25:40', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(306, '2026-02-08 16:25:57', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 1, 'asignó 20 permiso(s) al rol 1'),
(307, '2026-02-08 16:30:13', 'administrador', 3, '::1', 'usuarios_update', 'usuarios', 8, 'editó usuario 8 -> pedro'),
(308, '2026-02-08 19:49:31', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(309, '2026-02-08 20:26:24', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(310, '2026-02-08 20:26:54', 'administrador', 3, '::1', 'cursos_create', 'cursos', 1, 'creó curso ecuaciones A (2026-1)'),
(311, '2026-02-08 20:27:10', 'administrador', 3, '::1', 'matriculas_create', 'matriculas', NULL, 'matriculó estudiante 8 en curso 1'),
(312, '2026-02-08 20:27:24', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(313, '2026-02-08 20:27:33', 'docente', 12, '::1', 'login_ok', 'usuarios', 12, 'inicio de sesión'),
(314, '2026-02-08 20:28:28', 'docente', 12, '::1', 'logout', 'usuarios', 12, 'cierre de sesión'),
(315, '2026-02-08 20:29:03', 'pedro', 8, '::1', 'login_ok', 'usuarios', 8, 'inicio de sesión'),
(316, '2026-02-08 20:29:17', 'pedro', 8, '::1', 'logout', 'usuarios', 8, 'cierre de sesión'),
(317, '2026-02-08 20:29:34', 'docente', 12, '::1', 'login_ok', 'usuarios', 12, 'inicio de sesión'),
(318, '2026-02-08 20:31:46', 'docente', 12, '::1', 'logout', 'usuarios', 12, 'cierre de sesión'),
(319, '2026-02-08 20:31:48', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(320, '2026-02-08 20:32:05', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 16, 'asignó 2 permiso(s) al rol 16'),
(321, '2026-02-08 20:32:49', 'administrador', 3, '::1', 'cursos_create', 'cursos', 2, 'creó curso paralela B (2026-1)'),
(322, '2026-02-08 20:34:20', 'administrador', 3, '::1', 'cursos_update', 'cursos', 2, 'editó curso 2'),
(323, '2026-02-08 20:34:35', 'administrador', 3, '::1', 'matriculas_create', 'matriculas', NULL, 'matriculó estudiante 8 en curso 2'),
(324, '2026-02-08 20:34:50', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(325, '2026-02-08 20:34:55', 'docente', 12, '::1', 'login_ok', 'usuarios', 12, 'inicio de sesión'),
(326, '2026-02-08 22:59:00', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(327, '2026-02-08 22:59:18', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(328, '2026-02-08 23:07:11', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(329, '2026-02-08 23:07:57', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(330, '2026-02-08 23:15:38', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(331, '2026-02-09 00:57:38', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(332, '2026-02-09 00:58:17', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(333, '2026-02-09 00:58:18', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(334, '2026-02-09 00:59:25', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(335, '2026-02-09 00:59:27', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(336, '2026-02-09 01:03:01', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(337, '2026-02-09 01:14:08', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(338, '2026-02-09 02:16:55', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(339, '2026-02-09 02:18:36', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(340, '2026-02-09 02:19:01', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(341, '2026-02-09 02:20:53', 'administrador', 3, '::1', 'permisos_set', 'rol_permisos', 1, 'asignó 20 permiso(s) al rol 1'),
(342, '2026-02-09 02:21:32', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión'),
(343, '2026-02-09 02:23:07', 'administrador', 3, '::1', 'logout', 'usuarios', 3, 'cierre de sesión'),
(344, '2026-02-09 02:23:14', 'secretaria', 11, '::1', 'login_ok', 'usuarios', 11, 'inicio de sesión'),
(345, '2026-02-09 02:34:40', 'administrador', 3, '::1', 'login_ok', 'usuarios', 3, 'inicio de sesión');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `cursos`
--

CREATE TABLE `cursos` (
  `id` int NOT NULL,
  `nombre` varchar(120) COLLATE utf8mb4_general_ci NOT NULL,
  `paralelo` varchar(20) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'A',
  `periodo` varchar(60) COLLATE utf8mb4_general_ci NOT NULL,
  `dia_semana` tinyint NOT NULL DEFAULT '1',
  `dia_semana2` tinyint DEFAULT NULL,
  `hora_inicio` time NOT NULL DEFAULT '07:00:00',
  `hora_inicio2` time DEFAULT NULL,
  `hora_fin` time NOT NULL DEFAULT '08:00:00',
  `hora_fin2` time DEFAULT NULL,
  `aula` varchar(30) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `docente_id` int DEFAULT NULL,
  `creado_por` int DEFAULT NULL,
  `creado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `activo` tinyint(1) NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `cursos`
--

INSERT INTO `cursos` (`id`, `nombre`, `paralelo`, `periodo`, `dia_semana`, `dia_semana2`, `hora_inicio`, `hora_inicio2`, `hora_fin`, `hora_fin2`, `aula`, `docente_id`, `creado_por`, `creado_en`, `activo`) VALUES
(1, 'ecuaciones', 'A', '2026-1', 1, NULL, '07:00:00', NULL, '08:00:00', NULL, 'B-203', 12, 3, '2026-02-08 19:26:54', 1),
(2, 'paralela', 'B', '2026-1', 2, NULL, '09:00:00', NULL, '10:00:00', NULL, 'H-304', 12, 3, '2026-02-08 19:32:49', 1);

--
-- Disparadores `cursos`
--
DELIMITER $$
CREATE TRIGGER `cursos_chk_docente_bi` BEFORE INSERT ON `cursos` FOR EACH ROW BEGIN
  IF NEW.docente_id IS NOT NULL THEN
    IF (SELECT COALESCE(r.nombre,'') FROM usuarios u LEFT JOIN roles r ON r.id=u.rol_id WHERE u.id=NEW.docente_id) NOT IN ('docente') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='docente_id debe ser un usuario con rol docente';
    END IF;
  END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `cursos_chk_docente_bu` BEFORE UPDATE ON `cursos` FOR EACH ROW BEGIN
  IF NEW.docente_id IS NOT NULL THEN
    IF (SELECT COALESCE(r.nombre,'') FROM usuarios u LEFT JOIN roles r ON r.id=u.rol_id WHERE u.id=NEW.docente_id) NOT IN ('docente') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='docente_id debe ser un usuario con rol docente';
    END IF;
  END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `matriculas`
--

CREATE TABLE `matriculas` (
  `id` int NOT NULL,
  `curso_id` int NOT NULL,
  `estudiante_id` int NOT NULL,
  `estado` enum('ACTIVA','ANULADA') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'ACTIVA',
  `fecha` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `matriculas`
--

INSERT INTO `matriculas` (`id`, `curso_id`, `estudiante_id`, `estado`, `fecha`) VALUES
(1, 1, 8, 'ACTIVA', '2026-02-08 19:27:10'),
(2, 2, 8, 'ACTIVA', '2026-02-08 19:34:35');

--
-- Disparadores `matriculas`
--
DELIMITER $$
CREATE TRIGGER `matriculas_chk_estudiante_bi` BEFORE INSERT ON `matriculas` FOR EACH ROW BEGIN
  IF (SELECT COALESCE(r.nombre,'')
      FROM usuarios u
      LEFT JOIN roles r ON r.id=u.rol_id
      WHERE u.id=NEW.estudiante_id) NOT IN ('usuario','estudiante') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='estudiante_id debe ser un usuario tipo estudiante';
  END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `notas`
--

CREATE TABLE `notas` (
  `id` int NOT NULL,
  `curso_id` int NOT NULL,
  `estudiante_id` int NOT NULL,
  `p1_deberes` decimal(5,2) NOT NULL DEFAULT '0.00',
  `p1_prueba` decimal(5,2) NOT NULL DEFAULT '0.00',
  `p1_lab` decimal(5,2) NOT NULL DEFAULT '0.00',
  `p1_examen` decimal(5,2) NOT NULL DEFAULT '0.00',
  `p1_total` decimal(5,2) NOT NULL DEFAULT '0.00',
  `p2_deberes` decimal(5,2) NOT NULL DEFAULT '0.00',
  `p2_prueba` decimal(5,2) NOT NULL DEFAULT '0.00',
  `p2_lab` decimal(5,2) NOT NULL DEFAULT '0.00',
  `p2_examen` decimal(5,2) NOT NULL DEFAULT '0.00',
  `p2_total` decimal(5,2) NOT NULL DEFAULT '0.00',
  `p3_deberes` decimal(5,2) NOT NULL DEFAULT '0.00',
  `p3_prueba` decimal(5,2) NOT NULL DEFAULT '0.00',
  `p3_lab` decimal(5,2) NOT NULL DEFAULT '0.00',
  `p3_examen` decimal(5,2) NOT NULL DEFAULT '0.00',
  `p3_total` decimal(5,2) NOT NULL DEFAULT '0.00',
  `nota_final` decimal(5,2) NOT NULL DEFAULT '0.00',
  `estado` enum('APROBADO','SUPLETORIO','REPROBADO') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'REPROBADO',
  `actualizado_por` int DEFAULT NULL,
  `actualizado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Disparadores `notas`
--
DELIMITER $$
CREATE TRIGGER `trg_notas_bi` BEFORE INSERT ON `notas` FOR EACH ROW BEGIN
  SET NEW.p1_deberes = LEAST(GREATEST(NEW.p1_deberes,0),4);
  SET NEW.p1_prueba  = LEAST(GREATEST(NEW.p1_prueba ,0),5);
  SET NEW.p1_lab     = LEAST(GREATEST(NEW.p1_lab    ,0),4);
  SET NEW.p1_examen  = LEAST(GREATEST(NEW.p1_examen ,0),7);
  SET NEW.p1_total   = NEW.p1_deberes + NEW.p1_prueba + NEW.p1_lab + NEW.p1_examen;

  SET NEW.p2_deberes = LEAST(GREATEST(NEW.p2_deberes,0),4);
  SET NEW.p2_prueba  = LEAST(GREATEST(NEW.p2_prueba ,0),5);
  SET NEW.p2_lab     = LEAST(GREATEST(NEW.p2_lab    ,0),4);
  SET NEW.p2_examen  = LEAST(GREATEST(NEW.p2_examen ,0),7);
  SET NEW.p2_total   = NEW.p2_deberes + NEW.p2_prueba + NEW.p2_lab + NEW.p2_examen;

  SET NEW.p3_deberes = LEAST(GREATEST(NEW.p3_deberes,0),4);
  SET NEW.p3_prueba  = LEAST(GREATEST(NEW.p3_prueba ,0),5);
  SET NEW.p3_lab     = LEAST(GREATEST(NEW.p3_lab    ,0),4);
  SET NEW.p3_examen  = LEAST(GREATEST(NEW.p3_examen ,0),7);
  SET NEW.p3_total   = NEW.p3_deberes + NEW.p3_prueba + NEW.p3_lab + NEW.p3_examen;

  SET NEW.nota_final = ROUND(
    (NEW.p1_total * 0.3334) + (NEW.p2_total * 0.3333) + (NEW.p3_total * 0.3333)
  , 2);

  IF NEW.nota_final >= 14 THEN
    SET NEW.estado = 'APROBADO';
  ELSEIF NEW.nota_final >= 10 THEN
    SET NEW.estado = 'SUPLETORIO';
  ELSE
    SET NEW.estado = 'REPROBADO';
  END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_notas_bu` BEFORE UPDATE ON `notas` FOR EACH ROW BEGIN
  SET NEW.p1_deberes = LEAST(GREATEST(NEW.p1_deberes,0),4);
  SET NEW.p1_prueba  = LEAST(GREATEST(NEW.p1_prueba ,0),5);
  SET NEW.p1_lab     = LEAST(GREATEST(NEW.p1_lab    ,0),4);
  SET NEW.p1_examen  = LEAST(GREATEST(NEW.p1_examen ,0),7);
  SET NEW.p1_total   = NEW.p1_deberes + NEW.p1_prueba + NEW.p1_lab + NEW.p1_examen;

  SET NEW.p2_deberes = LEAST(GREATEST(NEW.p2_deberes,0),4);
  SET NEW.p2_prueba  = LEAST(GREATEST(NEW.p2_prueba ,0),5);
  SET NEW.p2_lab     = LEAST(GREATEST(NEW.p2_lab    ,0),4);
  SET NEW.p2_examen  = LEAST(GREATEST(NEW.p2_examen ,0),7);
  SET NEW.p2_total   = NEW.p2_deberes + NEW.p2_prueba + NEW.p2_lab + NEW.p2_examen;

  SET NEW.p3_deberes = LEAST(GREATEST(NEW.p3_deberes,0),4);
  SET NEW.p3_prueba  = LEAST(GREATEST(NEW.p3_prueba ,0),5);
  SET NEW.p3_lab     = LEAST(GREATEST(NEW.p3_lab    ,0),4);
  SET NEW.p3_examen  = LEAST(GREATEST(NEW.p3_examen ,0),7);
  SET NEW.p3_total   = NEW.p3_deberes + NEW.p3_prueba + NEW.p3_lab + NEW.p3_examen;

  SET NEW.nota_final = ROUND(
    (NEW.p1_total * 0.3334) + (NEW.p2_total * 0.3333) + (NEW.p3_total * 0.3333)
  , 2);

  IF NEW.nota_final >= 14 THEN
    SET NEW.estado = 'APROBADO';
  ELSEIF NEW.nota_final >= 10 THEN
    SET NEW.estado = 'SUPLETORIO';
  ELSE
    SET NEW.estado = 'REPROBADO';
  END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `permisos`
--

CREATE TABLE `permisos` (
  `id` int NOT NULL,
  `modulo` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `accion` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `descripcion` varchar(120) COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `permisos`
--

INSERT INTO `permisos` (`id`, `modulo`, `accion`, `descripcion`) VALUES
(1, 'dashboard', 'ver', 'panel principal'),
(2, 'usuarios', 'ver', 'ver usuarios'),
(3, 'usuarios', 'crear', 'crear usuarios'),
(4, 'usuarios', 'editar', 'editar usuarios'),
(5, 'usuarios', 'eliminar', 'eliminar usuarios'),
(6, 'roles', 'ver', 'ver roles'),
(7, 'roles', 'crear', 'crear roles'),
(8, 'roles', 'editar', 'editar roles'),
(9, 'roles', 'eliminar', 'eliminar roles'),
(10, 'permisos', 'ver', 'ver permisos'),
(11, 'permisos', 'editar', 'editar permisos'),
(12, 'cursos', 'ver', 'ver cursos'),
(13, 'cursos', 'crear', 'crear cursos'),
(14, 'cursos', 'asignar_docente', 'asignar docente a curso'),
(15, 'cursos', 'editar', 'editar cursos'),
(16, 'cursos', 'eliminar', 'eliminar/desactivar cursos'),
(17, 'matriculas', 'ver', 'ver matriculas'),
(18, 'matriculas', 'crear', 'matricular estudiante'),
(19, 'matriculas', 'anular', 'anular matricula'),
(20, 'notas', 'ver', 'ver notas'),
(21, 'notas', 'editar', 'editar/registrar notas'),
(22, 'reportes', 'ver', 'ver reportes'),
(35, 'reportes', 'pdf', 'generar reportes en pdf'),
(36, 'horarios', 'ver', 'ver horarios');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `roles`
--

CREATE TABLE `roles` (
  `id` int NOT NULL,
  `nombre` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `descripcion` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `es_sistema` tinyint(1) NOT NULL DEFAULT '0',
  `creado_por` int DEFAULT NULL,
  `creado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `roles`
--

INSERT INTO `roles` (`id`, `nombre`, `descripcion`, `es_sistema`, `creado_por`, `creado_en`) VALUES
(1, 'admin', 'administrador principal', 1, NULL, '2026-02-01 22:33:08'),
(11, 'jusn', 'hola', 0, NULL, '2026-02-03 15:18:11'),
(12, 'nuevorol2', 'hola como estas', 0, NULL, '2026-02-04 01:28:05'),
(13, 'pruebaderol', 'prueba1', 0, NULL, '2026-02-04 02:40:29'),
(14, 'crear_rol', 'hola', 0, NULL, '2026-02-05 23:13:30'),
(15, 'usuario', 'usuario del sistema', 0, NULL, '2026-02-06 12:28:06'),
(16, 'docente', 'docente del sistema', 0, NULL, '2026-02-07 21:43:45'),
(17, 'encargado', 'encargado académico', 0, NULL, '2026-02-07 21:43:45'),
(18, 'secretaria', 'secretaría académica', 0, NULL, '2026-02-08 14:03:01'),
(19, 'estudiante', 'estudiante', 0, NULL, '2026-02-08 15:19:27');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `rol_permisos`
--

CREATE TABLE `rol_permisos` (
  `rol_id` int NOT NULL,
  `permiso_id` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `rol_permisos`
--

INSERT INTO `rol_permisos` (`rol_id`, `permiso_id`) VALUES
(1, 2),
(12, 2),
(14, 2),
(15, 2),
(18, 2),
(1, 3),
(14, 3),
(15, 3),
(1, 4),
(14, 4),
(1, 5),
(14, 5),
(15, 5),
(1, 6),
(1, 7),
(12, 7),
(13, 7),
(1, 8),
(1, 9),
(1, 10),
(1, 11),
(1, 12),
(18, 12),
(1, 13),
(18, 13),
(1, 15),
(18, 15),
(1, 16),
(18, 16),
(1, 18),
(18, 18),
(1, 19),
(18, 19),
(1, 20),
(16, 20),
(19, 20),
(1, 21),
(16, 21),
(1, 22),
(19, 22),
(1, 36),
(19, 36);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuarios`
--

CREATE TABLE `usuarios` (
  `id` int NOT NULL,
  `usuario` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `nombres` varchar(60) COLLATE utf8mb4_general_ci NOT NULL,
  `apellidos` varchar(60) COLLATE utf8mb4_general_ci NOT NULL,
  `cedula` varchar(10) COLLATE utf8mb4_general_ci NOT NULL,
  `fecha_nacimiento` date NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `rol_id` int DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `creado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `intentos_fallidos` int NOT NULL DEFAULT '0',
  `bloqueado_hasta` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `usuarios`
--

INSERT INTO `usuarios` (`id`, `usuario`, `nombres`, `apellidos`, `cedula`, `fecha_nacimiento`, `password_hash`, `rol_id`, `activo`, `creado_en`, `intentos_fallidos`, `bloqueado_hasta`) VALUES
(3, 'administrador', 'Juan Felipe', 'Gutierrez Vargas', '1726871526', '2004-02-11', '$2y$10$/0qsHe7SHE2Owi9lPpmbU.6mkecu2xLmXL/C6K9koZ3b0RdayViFm', 1, 1, '2026-02-01 23:42:04', 0, NULL),
(5, 'tati', 'Tatiana Taty', 'Noriega Vargas', '1724693799', '2004-06-06', '$2y$10$Mc63loW4qWO2cPw/EXc.k.W.p2jZ3Y6Ws8egv/Bbf39fSkGdcmeL2', 1, 0, '2026-02-04 02:39:59', 0, NULL),
(8, 'pedro', 'Pedro', 'Pedro', '1726871542', '2004-11-11', '$2y$10$jLmZcFeKLKnBCUc9W3LPteRG40NIBnnlQJTEA6L6kdKopq.7jJLV.', 19, 1, '2026-02-05 23:15:01', 0, NULL),
(11, 'secretaria', 'Sonia', 'Tovar', '1712345675', '2000-11-11', '$2y$10$cK0lfNAJ9DiutWlSDRP.l.XAeAaNuhj7AjXH9GucWqZV6A4kRsUP2', 18, 1, '2026-02-08 15:17:26', 0, NULL),
(12, 'docente', 'Carlos', 'Bolagay', '0938172467', '1999-12-12', '$2y$10$RhScGQkb56F87ps0J4ule.aXqHCg4mygbzNh/y0u.XYTH.vaEjdgq', 16, 1, '2026-02-08 15:18:28', 0, NULL);

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `auditoria`
--
ALTER TABLE `auditoria`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_aud_fecha` (`fecha`),
  ADD KEY `idx_aud_usuario_id` (`usuario_id`),
  ADD KEY `idx_aud_accion` (`accion`);

--
-- Indices de la tabla `cursos`
--
ALTER TABLE `cursos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_cursos_docente` (`docente_id`),
  ADD KEY `idx_cursos_activo` (`activo`),
  ADD KEY `fk_cursos_creado_por` (`creado_por`),
  ADD KEY `idx_cursos_horario` (`periodo`,`dia_semana`,`hora_inicio`,`hora_fin`);

--
-- Indices de la tabla `matriculas`
--
ALTER TABLE `matriculas`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_matricula` (`curso_id`,`estudiante_id`),
  ADD UNIQUE KEY `uk_matricula_fk` (`curso_id`,`estudiante_id`),
  ADD KEY `idx_matriculas_estudiante` (`estudiante_id`);

--
-- Indices de la tabla `notas`
--
ALTER TABLE `notas`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_notas` (`curso_id`,`estudiante_id`),
  ADD KEY `fk_notas_estudiante` (`estudiante_id`),
  ADD KEY `idx_notas_actualizado_por` (`actualizado_por`);

--
-- Indices de la tabla `permisos`
--
ALTER TABLE `permisos`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_perm` (`modulo`,`accion`);

--
-- Indices de la tabla `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nombre` (`nombre`),
  ADD KEY `fk_roles_creado_por` (`creado_por`);

--
-- Indices de la tabla `rol_permisos`
--
ALTER TABLE `rol_permisos`
  ADD PRIMARY KEY (`rol_id`,`permiso_id`),
  ADD KEY `permiso_id` (`permiso_id`);

--
-- Indices de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `usuario` (`usuario`),
  ADD UNIQUE KEY `ux_usuarios_cedula` (`cedula`),
  ADD KEY `usuarios_ibfk_1` (`rol_id`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `auditoria`
--
ALTER TABLE `auditoria`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=346;

--
-- AUTO_INCREMENT de la tabla `cursos`
--
ALTER TABLE `cursos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `matriculas`
--
ALTER TABLE `matriculas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `notas`
--
ALTER TABLE `notas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `permisos`
--
ALTER TABLE `permisos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=37;

--
-- AUTO_INCREMENT de la tabla `roles`
--
ALTER TABLE `roles`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `cursos`
--
ALTER TABLE `cursos`
  ADD CONSTRAINT `fk_cursos_creado_por` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_cursos_docente` FOREIGN KEY (`docente_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `matriculas`
--
ALTER TABLE `matriculas`
  ADD CONSTRAINT `fk_matriculas_curso` FOREIGN KEY (`curso_id`) REFERENCES `cursos` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_matriculas_estudiante` FOREIGN KEY (`estudiante_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `notas`
--
ALTER TABLE `notas`
  ADD CONSTRAINT `fk_notas_actualizado_por` FOREIGN KEY (`actualizado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_notas_curso` FOREIGN KEY (`curso_id`) REFERENCES `cursos` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_notas_estudiante` FOREIGN KEY (`estudiante_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_notas_matricula` FOREIGN KEY (`curso_id`,`estudiante_id`) REFERENCES `matriculas` (`curso_id`, `estudiante_id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `roles`
--
ALTER TABLE `roles`
  ADD CONSTRAINT `fk_roles_creado_por` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `rol_permisos`
--
ALTER TABLE `rol_permisos`
  ADD CONSTRAINT `rol_permisos_ibfk_1` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `rol_permisos_ibfk_2` FOREIGN KEY (`permiso_id`) REFERENCES `permisos` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
